import { AuthenticationError, StampMitraError } from './errors.js';
import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  HttpClient,
  assertApiKeyShape,
  type AppInfo,
  type FetchLike,
  type Logger,
} from './http.js';
import type { Context } from './resources/base.js';
import { Estamp } from './resources/estamp.js';
import { Logs } from './resources/logs.js';
import { Orders } from './resources/orders.js';
import { Payments } from './resources/payments.js';
import { Services } from './resources/services.js';
import { Usage } from './resources/usage.js';
import { Verify } from './resources/verify.js';
import { Webhooks } from './resources/webhooks.js';

export interface StampMitraOptions {
  /** `sk_test_...` or `sk_live_...`. Defaults to `process.env.STAMPMITRA_API_KEY`. */
  apiKey?: string;
  /** Default `https://api-b2b.stampmitra.in`. */
  baseUrl?: string;
  /** Per-attempt timeout in ms (default 30000). */
  timeout?: number;
  /** Automatic retries for retry-safe calls (default 2). */
  maxRetries?: number;
  /** Custom `fetch` implementation (also the way to inject a mock in tests). */
  fetch?: FetchLike;
  /** Headers added to every request. */
  defaultHeaders?: Record<string, string>;
  /** Identifies your app in the User-Agent. */
  appInfo?: AppInfo;
  /** Receives redacted request/response debug records. Nothing is logged without one. */
  logger?: Logger;
  /** Validate and normalise inputs locally before sending (default true). */
  validateInput?: boolean;
  /** Accept API keys that do not match `sk_(test|live)_...`. */
  allowCustomKey?: boolean;
  /** Allow a live key in a browser runtime. Almost always a mistake: it leaks the key. */
  dangerouslyAllowBrowser?: boolean;
  /** Advanced/testing: replaces the backoff sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Advanced/testing: replaces the jitter source (returns [0,1)). */
  random?: () => number;
}

function isBrowser(): boolean {
  const g = globalThis as Record<string, unknown>;
  return typeof g.window !== 'undefined' && typeof g.document !== 'undefined' && !g.Deno;
}

export class StampMitra {
  readonly environment: 'test' | 'live' | 'custom';
  readonly baseUrl: string;
  readonly verify: Verify;
  readonly services: Services;
  readonly estamp: Estamp;
  readonly orders: Orders;
  readonly payments: Payments;
  readonly usage: Usage;
  readonly logs: Logs;
  readonly webhooks: Webhooks;

  constructor(options: StampMitraOptions = {}) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    const apiKey = options.apiKey ?? env?.STAMPMITRA_API_KEY;
    if (!apiKey) {
      throw new AuthenticationError(
        'No API key provided. Pass { apiKey } or set the STAMPMITRA_API_KEY environment variable.',
      );
    }
    assertApiKeyShape(apiKey, options.allowCustomKey ?? false);
    this.environment = apiKey.startsWith('sk_live_')
      ? 'live'
      : apiKey.startsWith('sk_test_')
        ? 'test'
        : 'custom';

    if (isBrowser()) {
      if (this.environment === 'live' && !options.dangerouslyAllowBrowser) {
        throw new StampMitraError(
          'Refusing to use a live (sk_live_) API key in a browser: it would be exposed to every visitor. ' +
            'Call StampMitra from your server instead (or pass dangerouslyAllowBrowser: true at your own risk).',
        );
      }
      console.warn(
        '[stampmitra] API keys are secrets. Do not ship sk_ keys in browser or mobile apps; proxy through your server.',
      );
    }

    const fetchImpl =
      options.fetch ?? (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new StampMitraError(
        'No global fetch available (Node >= 18 required). Pass a fetch implementation via the `fetch` option.',
      );
    }
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const http = new HttpClient({
      apiKey,
      baseUrl: this.baseUrl,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetch: fetchImpl,
      defaultHeaders: options.defaultHeaders ?? {},
      appInfo: options.appInfo,
      logger: options.logger,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      random: options.random ?? Math.random,
    });
    const ctx: Context = { http, validateInput: options.validateInput ?? true };
    this.verify = new Verify(ctx);
    this.services = new Services(ctx);
    this.estamp = new Estamp(ctx);
    this.orders = new Orders(ctx);
    this.payments = new Payments(ctx);
    this.usage = new Usage(ctx);
    this.logs = new Logs(ctx);
    this.webhooks = new Webhooks(ctx);
  }

  /** Never serialises the key. */
  toJSON(): Record<string, unknown> {
    return { environment: this.environment, baseUrl: this.baseUrl };
  }
}
