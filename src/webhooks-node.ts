/**
 * Synchronous webhook verification for Node.js using `node:crypto`.
 * Same scheme as `@stampmitra/sdk/webhooks`: hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookSignatureError } from './errors.js';
import {
  bodyToString,
  checkTimestamp,
  DEFAULT_TOLERANCE_SECONDS,
  extractWebhookHeaders,
  finish,
  type RawBody,
  type VerifyOptions,
  type WebhookEvent,
} from './webhooks.js';

export { WebhookSignatureError };
export {
  extractWebhookHeaders,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  type RawBody,
  type VerifyOptions,
  type WebhookEvent,
} from './webhooks.js';

export function computeSignature(
  secret: string,
  timestamp: string | number,
  payload: RawBody,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${bodyToString(payload)}`)
    .digest('hex');
}

function diagnose(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number,
): 'ok' | 'malformed' | 'stale' | 'mismatch' {
  const opts = typeof options === 'number' ? { toleranceSeconds: options } : options;
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (typeof secret !== 'string' || secret === '' || typeof signature !== 'string')
    return 'malformed';
  const t = checkTimestamp(timestamp, tolerance, opts.now ?? Date.now());
  if (t !== 'ok') return t;
  const sig = signature;
  if (!/^[0-9a-f]{64}$/.test(sig)) return 'mismatch'; // empty / non-hex / upper-case hex
  const expected = Buffer.from(computeSignature(secret, timestamp, payload), 'hex');
  const given = Buffer.from(sig, 'hex');
  return timingSafeEqual(expected, given) ? 'ok' : 'mismatch';
}

/** Returns `false` for tampered, stale, wrong-secret or malformed input; never throws. */
export function verifySignature(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number = {},
): boolean {
  return diagnose(payload, timestamp, signature, secret, options) === 'ok';
}

/** Verifies, then parses the JSON body. Throws {@link WebhookSignatureError} on failure. */
export function constructEvent<T = WebhookEvent>(
  payload: RawBody,
  timestamp: string | number,
  signature: string,
  secret: string,
  options: VerifyOptions | number = {},
): T {
  return finish<T>(diagnose(payload, timestamp, signature, secret, options), payload);
}

export function constructEventFromHeaders<T = WebhookEvent>(
  payload: RawBody,
  headers: Parameters<typeof extractWebhookHeaders>[0],
  secret: string,
  options: VerifyOptions | number = {},
): T {
  const h = extractWebhookHeaders(headers);
  if (!h.timestamp || !h.signature) {
    throw new WebhookSignatureError(
      'Missing X-Webhook-Timestamp or X-Webhook-Signature header',
      'malformed',
    );
  }
  return constructEvent<T>(payload, h.timestamp, h.signature, secret, options);
}
