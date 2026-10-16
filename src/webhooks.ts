/**
 * Webhook signature verification using WebCrypto (`crypto.subtle`), so it runs on Node 18+,
 * Cloudflare Workers, Deno, Bun and browsers. For a synchronous Node implementation see
 * `@stampmitra/sdk/webhooks-node`.
 *
 * Scheme (matches the platform's delivery worker): the signature is the lower-case hex
 * HMAC-SHA256 of `${timestamp}.${rawBody}` keyed with your endpoint secret, where `timestamp`
 * is Unix epoch seconds. Delivery headers:
 *   X-Webhook-Signature, X-Webhook-Timestamp, X-Webhook-Event-Id
 */
import { WebhookSignatureError } from './errors.js';

export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-webhook-timestamp';
export const WEBHOOK_EVENT_ID_HEADER = 'x-webhook-event-id';
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** A delivered event body. The shape is defined by the event producer; unknown fields are kept. */
export type WebhookEvent = Record<string, unknown>;

export interface VerifyOptions {
  /** Max allowed clock skew in seconds (default 300). `Infinity` disables the freshness check. */
  toleranceSeconds?: number;
  /** Current time in ms; for tests. */
  now?: number;
}

export type RawBody = string | Uint8Array | ArrayBuffer;

export function bodyToString(payload: RawBody): string {
  if (typeof payload === 'string') return payload;
  return new TextDecoder().decode(
    payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload,
  );
}

/** Returns `'ok'`, or the reason the timestamp/signature input is unusable. */
export function checkTimestamp(
  timestamp: string | number,
  tolerance: number,
  nowMs: number,
): 'ok' | 'malformed' | 'stale' {
  const ts = typeof timestamp === 'number' ? timestamp : Number(String(timestamp).trim());
  if (!Number.isFinite(ts) || ts <= 0) return 'malformed';
  if (Math.abs(nowMs / 1000 - ts) > tolerance) return 'stale';
  return 'ok';
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | undefined {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return undefined;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function getSubtle(): Promise<SubtleCrypto> {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.subtle) return c.subtle;
  // Node 18 without a global `crypto`: load WebCrypto lazily. The specifier is indirect so that
  // edge bundlers (which always have `crypto.subtle`) never try to resolve it.
  const spec = 'node:crypto';
  const mod = (await import(/* @vite-ignore */ spec)) as { webcrypto: Crypto };
  return mod.webcrypto.subtle;
}

/** Computes the hex signature for a payload. Exposed for tests and for producing fixtures. */
export async function computeSignature(
  secret: string,
  timestamp: string | number,
  payload: RawBody,
): Promise<string> {
  const subtle = await getSubtle();
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await subtle.sign('HMAC', key, enc.encode(`${timestamp}.${bodyToString(payload)}`)),
  );
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a webhook signature. Returns `false` (never throws) for a bad, tampered, stale or
 * malformed input. Uses `crypto.subtle.verify`, which compares in constant time.
 *
 * Pass the RAW request body exactly as received: re-serialising parsed JSON can change bytes.
 */
export async function verifySignature(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number = {},
): Promise<boolean> {
  return (await diagnose(payload, timestamp, signature, secret, options)) === 'ok';
}

/** Alias of {@link verifySignature}, for symmetry with the synchronous Node variant. */
export const verifySignatureAsync = verifySignature;

async function diagnose(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number,
): Promise<'ok' | 'malformed' | 'stale' | 'mismatch'> {
  const opts = typeof options === 'number' ? { toleranceSeconds: options } : options;
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (typeof secret !== 'string' || secret === '' || typeof signature !== 'string')
    return 'malformed';
  const t = checkTimestamp(timestamp, tolerance, opts.now ?? Date.now());
  if (t !== 'ok') return t;
  const sigBytes = hexToBytes(signature);
  if (!sigBytes) return 'mismatch'; // empty / non-hex / upper-case hex: never a valid signature
  const subtle = await getSubtle();
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await subtle.verify(
    'HMAC',
    key,
    sigBytes,
    enc.encode(`${timestamp}.${bodyToString(payload)}`),
  );
  return ok ? 'ok' : 'mismatch';
}

/** Verifies, then parses the body. Throws {@link WebhookSignatureError} when verification fails. */
export async function constructEvent<T = WebhookEvent>(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number = {},
): Promise<T> {
  const verdict = await diagnose(payload, timestamp, signature, secret, options);
  return finish<T>(verdict, payload);
}

export function finish<T>(verdict: 'ok' | 'malformed' | 'stale' | 'mismatch', payload: RawBody): T {
  if (verdict === 'stale')
    throw new WebhookSignatureError('Webhook timestamp is outside the tolerance window', 'stale');
  if (verdict === 'malformed')
    throw new WebhookSignatureError('Webhook signature or timestamp is malformed', 'malformed');
  if (verdict === 'mismatch')
    throw new WebhookSignatureError('Webhook signature does not match', 'mismatch');
  try {
    return JSON.parse(bodyToString(payload)) as T;
  } catch {
    throw new WebhookSignatureError('Webhook body is not valid JSON', 'malformed');
  }
}

type HeaderBag =
  { get(name: string): string | null } | Record<string, string | string[] | undefined>;

/** Reads the delivery headers from a fetch `Headers` or a Node/Express-style header object. */
export function extractWebhookHeaders(headers: HeaderBag): {
  timestamp: string | undefined;
  signature: string | undefined;
  eventId: string | undefined;
} {
  const read = (name: string): string | undefined => {
    if (typeof (headers as { get?: unknown }).get === 'function') {
      return (headers as { get(n: string): string | null }).get(name) ?? undefined;
    }
    const rec = headers as Record<string, string | string[] | undefined>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === name);
    const v = key ? rec[key] : undefined;
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    timestamp: read(WEBHOOK_TIMESTAMP_HEADER),
    signature: read(WEBHOOK_SIGNATURE_HEADER),
    eventId: read(WEBHOOK_EVENT_ID_HEADER),
  };
}

/** Convenience: read the delivery headers, verify, parse. Use `extractWebhookHeaders` for the event id. */
export async function constructEventFromHeaders<T = WebhookEvent>(
  payload: RawBody,
  headers: HeaderBag,
  secret: string,
  options: VerifyOptions | number = {},
): Promise<T> {
  const h = extractWebhookHeaders(headers);
  if (!h.timestamp || !h.signature) {
    throw new WebhookSignatureError(
      'Missing X-Webhook-Timestamp or X-Webhook-Signature header',
      'malformed',
    );
  }
  const verdict = await diagnose(payload, h.timestamp, h.signature, secret, options);
  return finish<T>(verdict, payload);
}

export { WebhookSignatureError };
