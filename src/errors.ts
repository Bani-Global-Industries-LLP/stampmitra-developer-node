/** Shape of the error envelope returned by the API: `{ error: { code, message, requestId, field? } }`. */
export interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    field?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface StampMitraErrorOptions {
  status?: number;
  code?: string;
  requestId?: string;
  /** The parsed (or raw text) response body, if any. */
  raw?: unknown;
  cause?: unknown;
}

/** Base class of every error thrown by the SDK. */
export class StampMitraError extends Error {
  /** HTTP status; `undefined` for errors that never reached the server. */
  readonly status: number | undefined;
  /** Machine-readable error code from the API (e.g. `BAD_REQUEST`). */
  readonly code: string | undefined;
  /** Server-assigned request id; quote it when contacting support. */
  readonly requestId: string | undefined;
  /** Raw response body (parsed JSON when possible, otherwise text). */
  readonly raw: unknown;

  constructor(message: string, options: StampMitraErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.raw = options.raw;
  }
}

/** 400 / 422. `field` names the offending request field when known. Also raised locally by client-side validation. */
export class ValidationError extends StampMitraError {
  readonly field: string | undefined;
  /** `true` when raised by the SDK before any request was sent (nothing was billed). */
  readonly local: boolean;
  constructor(
    message: string,
    options: StampMitraErrorOptions & { field?: string; local?: boolean } = {},
  ) {
    super(message, options);
    this.field = options.field;
    this.local = options.local ?? false;
  }
}

/** 401: missing, malformed or revoked API key. */
export class AuthenticationError extends StampMitraError {}
/** 402: insufficient wallet balance. */
export class PaymentRequiredError extends StampMitraError {}
/** 403: key valid but lacks scope / IP allowlist. The server message is surfaced verbatim. */
export class PermissionError extends StampMitraError {}
/** 404 */
export class NotFoundError extends StampMitraError {}
/** 409 */
export class ConflictError extends StampMitraError {}

/** 429. `retryAfter` is in seconds, from the `Retry-After` header. */
export class RateLimitError extends StampMitraError {
  readonly retryAfter: number | undefined;
  constructor(message: string, options: StampMitraErrorOptions & { retryAfter?: number } = {}) {
    super(message, options);
    this.retryAfter = options.retryAfter;
  }
}

/** 5xx: the API or one of its upstream providers failed. */
export class UpstreamError extends StampMitraError {}

/** The request could not be sent or the connection dropped before a response arrived. */
export class ConnectionError extends StampMitraError {
  /** `true` when the failure happened before any response headers arrived (so no response was received). */
  readonly beforeResponse: boolean;
  constructor(
    message: string,
    options: StampMitraErrorOptions & { beforeResponse?: boolean } = {},
  ) {
    super(message, options);
    this.beforeResponse = options.beforeResponse ?? false;
  }
}
/** The request exceeded the configured timeout. */
export class TimeoutError extends ConnectionError {}
/** The caller aborted the request through `signal`. */
export class RequestAbortedError extends StampMitraError {}

/** Webhook signature verification failed. `reason` says why. */
export class WebhookSignatureError extends StampMitraError {
  readonly reason: 'malformed' | 'stale' | 'mismatch';
  constructor(message: string, reason: 'malformed' | 'stale' | 'mismatch') {
    super(message);
    this.reason = reason;
  }
}

export function errorFromResponse(
  status: number,
  body: unknown,
  headers: { get(name: string): string | null },
): StampMitraError {
  const env =
    body && typeof body === 'object'
      ? ((body as ErrorBody).error as ErrorBody['error'])
      : undefined;
  const message =
    (env && typeof env.message === 'string' && env.message) ||
    (typeof body === 'string' && body.trim().slice(0, 300)) ||
    `Request failed with status ${status}`;
  const opts: StampMitraErrorOptions = {
    status,
    code: env && typeof env.code === 'string' ? env.code : undefined,
    requestId:
      (env && typeof env.requestId === 'string' ? env.requestId : undefined) ??
      headers.get('x-request-id') ??
      undefined,
    raw: body,
  };
  switch (true) {
    case status === 400 || status === 422:
      return new ValidationError(message, {
        ...opts,
        field: env && typeof env.field === 'string' ? env.field : undefined,
      });
    case status === 401:
      return new AuthenticationError(message, opts);
    case status === 402:
      return new PaymentRequiredError(message, opts);
    case status === 403:
      return new PermissionError(message, opts);
    case status === 404:
      return new NotFoundError(message, opts);
    case status === 409:
      return new ConflictError(message, opts);
    case status === 429:
      return new RateLimitError(message, {
        ...opts,
        retryAfter: parseRetryAfter(headers.get('retry-after')),
      });
    case status >= 500:
      return new UpstreamError(message, opts);
    default:
      return new StampMitraError(message, opts);
  }
}

/** Parses a `Retry-After` header (delta-seconds or HTTP-date) into seconds. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return secs;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, (date - now) / 1000);
  return undefined;
}
