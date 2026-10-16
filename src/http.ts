import {
  AuthenticationError,
  ConnectionError,
  RequestAbortedError,
  StampMitraError,
  TimeoutError,
  UpstreamError,
  errorFromResponse,
  parseRetryAfter,
} from './errors.js';
import { redactBody, redactHeaders } from './redact.js';
import { VERSION } from './version.js';

export const DEFAULT_BASE_URL = 'https://api-b2b.stampmitra.in';
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
/** We honour Retry-After but never sleep longer than this inside an automatic retry. */
const RETRY_AFTER_CAP_MS = 60_000;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface AppInfo {
  name: string;
  version?: string;
  url?: string;
}

/** Options accepted by every API method. */
export interface RequestOptions {
  /** Per-attempt timeout in milliseconds. */
  timeout?: number;
  maxRetries?: number;
  /** Overrides the auto-generated `Idempotency-Key`. Passing one on any POST also enables retries for it. */
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface RawResponse {
  status: number;
  headers: Headers;
  requestId: string | undefined;
  /** Number of HTTP attempts made (1 = no retries). */
  attempts: number;
}

export interface HttpConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  fetch: FetchLike;
  defaultHeaders: Record<string, string>;
  appInfo?: AppInfo;
  logger?: Logger;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

export interface RequestSpec {
  method: 'GET' | 'POST';
  path: string;
  query?: object;
  body?: unknown;
  /** Generate an `Idempotency-Key` automatically when the caller does not supply one. */
  autoIdempotency?: boolean;
}

/** A promise for the parsed body that can also expose the raw response metadata via `withResponse()`. */
export class APIPromise<T> implements Promise<T> {
  readonly [Symbol.toStringTag] = 'APIPromise';
  private readonly inner: Promise<{ data: T; response: RawResponse }>;
  constructor(inner: Promise<{ data: T; response: RawResponse }>) {
    this.inner = inner;
  }
  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.inner.then((r) => r.data).then(onfulfilled, onrejected);
  }
  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.then(undefined, onrejected);
  }
  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.then().finally(onfinally);
  }
  /** Resolves with the parsed body plus status, headers and request id. */
  withResponse(): Promise<{ data: T; response: RawResponse }> {
    return this.inner;
  }
}

/** An APIPromise that rejects, so local failures (e.g. validation) surface like any other error. */
export function rejectedAPIPromise<T>(err: unknown): APIPromise<T> {
  const p: Promise<{ data: T; response: RawResponse }> = Promise.reject(err);
  p.catch(() => undefined); // no unhandled-rejection noise; callers still observe the rejection via then/await
  return new APIPromise<T>(p);
}

export function uuidv4(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function runtimeString(): string {
  const g = globalThis as Record<string, unknown>;
  const proc = g.process as { version?: string; versions?: Record<string, string> } | undefined;
  if (g.Deno)
    return `deno/${(g.Deno as { version?: { deno?: string } }).version?.deno ?? 'unknown'}`;
  if (proc?.versions?.bun) return `bun/${proc.versions.bun}`;
  if (proc?.version) return `node/${proc.version.replace(/^v/, '')}`;
  if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers')
    return 'workerd';
  return 'unknown';
}

export function buildUserAgent(appInfo?: AppInfo): string {
  let ua = `stampmitra-node/${VERSION} (${runtimeString()})`;
  if (appInfo) {
    ua += ` ${appInfo.name}${appInfo.version ? `/${appInfo.version}` : ''}${appInfo.url ? ` (${appInfo.url})` : ''}`;
  }
  return ua;
}

function buildQuery(query?: object): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export class HttpClient {
  constructor(readonly config: HttpConfig) {}

  request<T>(spec: RequestSpec, opts: RequestOptions = {}): APIPromise<T> {
    return new APIPromise<T>(this.execute<T>(spec, opts));
  }

  private log(message: string, meta: Record<string, unknown>): void {
    const logger = this.config.logger;
    if (!logger) return;
    try {
      logger.debug(message, meta);
    } catch {
      /* a broken logger must never break a request */
    }
  }

  private async execute<T>(
    spec: RequestSpec,
    opts: RequestOptions,
  ): Promise<{ data: T; response: RawResponse }> {
    const cfg = this.config;
    const maxRetries = opts.maxRetries ?? cfg.maxRetries;
    const timeout = opts.timeout ?? cfg.timeout;
    const url = `${cfg.baseUrl}${spec.path}${buildQuery(spec.query)}`;

    // One key per logical call, reused on every automatic retry.
    const idempotencyKey = opts.idempotencyKey ?? (spec.autoIdempotency ? uuidv4() : undefined);
    const retrySafe = spec.method === 'GET' || idempotencyKey !== undefined;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': buildUserAgent(cfg.appInfo),
      ...cfg.defaultHeaders,
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...opts.headers,
    };
    const body = spec.body === undefined ? undefined : JSON.stringify(spec.body);

    for (let attempt = 0; ; attempt++) {
      const canRetry = retrySafe && attempt < maxRetries;
      this.log('stampmitra request', {
        method: spec.method,
        url,
        attempt: attempt + 1,
        headers: redactHeaders(headers),
        body: spec.body === undefined ? undefined : redactBody(spec.body),
      });
      const started = Date.now();
      let response: Response;
      let text: string;
      try {
        ({ response, text } = await this.send(
          url,
          spec.method,
          headers,
          body,
          timeout,
          opts.signal,
        ));
      } catch (err) {
        if (err instanceof RequestAbortedError) throw err;
        this.log('stampmitra connection error', {
          method: spec.method,
          url,
          attempt: attempt + 1,
          error: err instanceof Error ? err.name : 'unknown',
        });
        // Billed POSTs (no idempotency key) are retried only after a connection failure that
        // happened before any response arrived; never after a timeout or a received response.
        const preResponseConnFailure =
          err instanceof ConnectionError && !(err instanceof TimeoutError) && err.beforeResponse;
        if (attempt < maxRetries && (retrySafe || preResponseConnFailure)) {
          await this.sleepBackoff(attempt, undefined, opts.signal);
          continue;
        }
        throw err;
      }

      const parsed = parseBody(text);
      const requestId =
        response.headers.get('x-request-id') ??
        (parsed && typeof parsed === 'object'
          ? ((parsed as { error?: { requestId?: string } }).error?.requestId ?? undefined)
          : undefined) ??
        undefined;
      this.log('stampmitra response', {
        method: spec.method,
        url,
        status: response.status,
        requestId,
        durationMs: Date.now() - started,
        body: redactBody(parsed),
      });

      if (response.ok) {
        if (text.trim() !== '' && parsed === undefined) {
          throw new UpstreamError('Received a non-JSON success response', {
            status: response.status,
            requestId,
            raw: text,
          });
        }
        return {
          data: parsed as T,
          response: {
            status: response.status,
            headers: response.headers,
            requestId,
            attempts: attempt + 1,
          },
        };
      }

      if (canRetry && RETRYABLE_STATUS.has(response.status)) {
        await this.sleepBackoff(
          attempt,
          parseRetryAfter(response.headers.get('retry-after')),
          opts.signal,
        );
        continue;
      }
      throw errorFromResponse(response.status, parsed ?? text, response.headers);
    }
  }

  private async sleepBackoff(
    attempt: number,
    retryAfterSeconds: number | undefined,
    signal?: AbortSignal,
  ): Promise<void> {
    const cfg = this.config;
    let ms: number;
    if (retryAfterSeconds !== undefined) {
      ms = Math.min(retryAfterSeconds * 1000, RETRY_AFTER_CAP_MS);
    } else {
      ms = cfg.random() * Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt); // full jitter
    }
    if (signal?.aborted) throw new RequestAbortedError('Request aborted');
    await cfg.sleep(ms);
    if (signal?.aborted) throw new RequestAbortedError('Request aborted');
  }

  private async send(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    timeoutMs: number,
    userSignal?: AbortSignal,
  ): Promise<{ response: Response; text: string }> {
    const controller = new AbortController();
    let timedOut = false;
    let gotResponse = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onUserAbort = () => controller.abort();
    if (userSignal) {
      if (userSignal.aborted) controller.abort();
      else userSignal.addEventListener('abort', onUserAbort, { once: true });
    }
    try {
      const response = await this.config.fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      gotResponse = true;
      const text = await response.text();
      return { response, text };
    } catch (err) {
      if (timedOut) {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`, { cause: err });
      }
      if (userSignal?.aborted) {
        throw new RequestAbortedError('Request aborted', { cause: err });
      }
      if (err instanceof StampMitraError) throw err;
      throw new ConnectionError(
        `Connection error: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err, beforeResponse: !gotResponse },
      );
    } finally {
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onUserAbort);
    }
  }
}

function parseBody(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function assertApiKeyShape(key: string, allowCustom: boolean): void {
  if (!allowCustom && !/^sk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(key)) {
    throw new AuthenticationError(
      'Invalid API key format: expected sk_test_... or sk_live_... (pass allowCustomKey: true to bypass).',
    );
  }
}
