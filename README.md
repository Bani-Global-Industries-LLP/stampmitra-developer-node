# @stampmitra/sdk

[![npm](https://img.shields.io/npm/v/@stampmitra/sdk)](https://www.npmjs.com/package/@stampmitra/sdk)
[![CI](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-node/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Official Node.js / TypeScript SDK for the [StampMitra Developer API](https://developer.stampmitra.in/docs):
Indian identity verification (PAN, GSTIN, RC, Voter ID, Driving Licence, Passport, CIN, Udyam, bank account)
and e-Stamp. Zero runtime dependencies, dual ESM/CJS, fully typed.

> **Status: pre-1.0 (0.1.0).** The API surface may change in minor releases until 1.0. The npm badge
> above shows a version only once the package is published; until then it (and `npm install`) will 404.

Docs: <https://developer.stampmitra.in/sdks/node> | API reference: <https://developer.stampmitra.in/docs>

## Install

```sh
npm install @stampmitra/sdk
```

**Supported runtimes:** Node 18, 20 and 22 (CI-tested; uses the global `fetch` and WebCrypto). The core entry
point has no `node:` imports and is verified on Cloudflare Workers (workerd); Bun and Deno are expected to work.
ESM and CommonJS are both supported, with TypeScript types for `moduleResolution` `node16`/`nodenext` and `bundler`.
Zero runtime dependencies.

## Quickstart

```ts
import { StampMitra } from '@stampmitra/sdk';

const client = new StampMitra(); // reads STAMPMITRA_API_KEY
const res = await client.verify.pan({ pan: 'ABCDE1234F', name: 'Rahul Kumar' });
console.log(res.referenceId, res.valid, res.nameMatchResult);
```

## Authentication

Pass `apiKey` or set `STAMPMITRA_API_KEY` (never hard-code it). Keys look like `sk_test_...` (free sandbox) or `sk_live_...`
(metered). `client.environment` is `'test' | 'live'`. Keys that do not match
`^sk_(test|live)_[A-Za-z0-9_-]{8,}$` are rejected unless `allowCustomKey: true`.

**Security:** use this SDK **server-side only**. Never ship `sk_` keys in browser or mobile apps. In a
browser runtime the constructor refuses `sk_live_` keys (and warns for test keys).

## Client options

```ts
new StampMitra({
  apiKey,
  baseUrl: 'https://api-b2b.stampmitra.in',
  timeout: 30_000,
  maxRetries: 2,
  fetch,
  defaultHeaders,
  appInfo: { name: 'my-app', version: '1.0.0', url: 'https://your-company.in' },
  logger,
  validateInput: true,
  allowCustomKey: false,
});
```

`baseUrl` must be `https://` (plain `http://` is accepted only for `localhost`, `127.0.0.1` and `::1`, e.g.
when running the [mock server](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-openapi));
redirects are never followed, so the key cannot be forwarded to another host.

Every method also accepts per-request options as its last argument:
`{ timeout, maxRetries, idempotencyKey, headers, signal }`.

## Resources

| Namespace                 | Methods                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `client.verify`           | `pan`, `gstin`, `rc`, `voterId`, `drivingLicense`, `passport`, `cin`, `udyam`, `panToGstin`, `panToUdyam`, `bankAccount`            |
| `client.services`         | `list`, `get`                                                                                                                       |
| `client.estamp`           | `getSchema`, `listStates`, `listInstruments`, `listArticles`, `calculateDuty`, `addParties`                                         |
| `client.orders`           | `create`, `get`, `getStatus`, `getPayment`, `listDocuments`, `getDocumentDownload` (orders are addressed by your `externalOrderId`) |
| `client.payments.intents` | `create`, `get`                                                                                                                     |
| `client.usage`            | `summary`                                                                                                                           |
| `client.logs`             | `list`, `listAll`                                                                                                                   |
| `client.webhooks.events`  | `list`, `listAll`, `replay`                                                                                                         |

That is all 31 operations of the API. Examples:

```ts
// Verification (POST /v1/verify/*). Every call, including negative results, is billed.
await client.verify.pan({ pan: 'ABCDE1234F' });
await client.verify.gstin({ gstin: '07AAAAA1111A1Z1', businessName: 'Jane Doe Enterprises' });
await client.verify.rc({ vehicleNumber: 'MH12AB1234' });
await client.verify.voterId({ voterId: 'ABC1234567' });
await client.verify.drivingLicense({ dlNumber: 'MH1420110012345', dob: '1990-01-01' }); // IP-allowlisted key
await client.verify.passport({ fileNumber: 'PA1079341954215', dob: '1990-01-01' }); // IP-allowlisted key
await client.verify.cin({ cin: 'U74999DL2015PTC284009' });
await client.verify.udyam({ udyamNumber: 'UDYAM-MH-12-1234567' });
await client.verify.panToGstin({ pan: 'ABCDE1234F' });
await client.verify.panToUdyam({ pan: 'ABCDE1234F' });
await client.verify.bankAccount({
  accountNumber: '000123456789',
  ifsc: 'ICIC0001234',
  name: 'Ravi Kumar',
});

// Services & e-Stamp reference data
await client.services.list();
await client.services.get('estamp.instrument.rent_agreement');
await client.estamp.getSchema('estamp.instrument.rent_agreement');
await client.estamp.listStates();
await client.estamp.listInstruments('MH');
await client.estamp.listArticles('INSTRUMENT_CODE');
await client.estamp.calculateDuty({/* see e-Stamp docs */});

// Orders & payments
const order = await client.orders.create({
  externalOrderId: 'o1',
  externalCustomerId: 'c1',
  serviceCode: 'estamp.instrument.rent_agreement',
  details: {},
});
await client.estamp.addParties('EXTERNAL_ORDER_ID', {/* parties */});
await client.orders.get('EXTERNAL_ORDER_ID');
await client.orders.getStatus('EXTERNAL_ORDER_ID');
await client.orders.getPayment('EXTERNAL_ORDER_ID');
await client.orders.listDocuments('EXTERNAL_ORDER_ID');
await client.orders.getDocumentDownload('EXTERNAL_ORDER_ID', 'DOCUMENT_ID'); // short-lived signed URL
await client.payments.intents.create({/* see payment docs */});
await client.payments.intents.get('INTENT_ID');

// Usage, logs, webhook deliveries
await client.usage.summary();
await client.logs.list({ service: 'estamp', status: 'failure', limit: 50 });
await client.webhooks.events.list({ limit: 20 });
await client.webhooks.events.replay('EVENT_ID');
```

Response bodies are typed from the API examples; fields the SDK does not know about are preserved.
Payloads whose shape the API has not finalised (e-Stamp `details`, duty, parties, payment intent) are
typed as open objects.

### Raw response access

```ts
const { data, response } = await client.verify.pan({ pan: 'ABCDE1234F' }).withResponse();
console.log(
  response.status,
  response.requestId,
  response.headers.get('content-type'),
  response.attempts,
);
```

## Error handling

All errors extend `StampMitraError` (`status`, `code`, `message`, `requestId`, `raw`).

| HTTP                      | Class                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| 400 / 422                 | `ValidationError` (`field`)                                             |
| 401                       | `AuthenticationError`                                                   |
| 402                       | `PaymentRequiredError`                                                  |
| 403                       | `PermissionError` (server message verbatim, e.g. IP allowlist required) |
| 404                       | `NotFoundError`                                                         |
| 409                       | `ConflictError`                                                         |
| 429                       | `RateLimitError` (`retryAfter` seconds, when the server sends it)       |
| 5xx                       | `UpstreamError`                                                         |
| network / timeout / abort | `ConnectionError` / `TimeoutError` / `RequestAbortedError`              |

Errors are mapped by status only, so non-JSON error bodies still produce the right class.

```ts
import { ValidationError, RateLimitError } from '@stampmitra/sdk';
try {
  await client.verify.pan({ pan: 'ABCDE1234F' });
} catch (e) {
  if (e instanceof RateLimitError) console.log(e.retryAfter, e.requestId);
  else throw e;
}
```

## Retries and idempotency

- Default `maxRetries: 2`, exponential backoff with full jitter (base 0.5s, cap 8s); `Retry-After` is honoured when sent.
- Retried: 429, 502, 503, 504, connection errors and timeouts.
- `GET` is always retry-safe.
- `POST /v1/orders`, `POST /v1/payments/intents` and `POST /v1/estamp/orders/{id}/parties` automatically send an
  `Idempotency-Key` (UUIDv4, or your `idempotencyKey`), **reused across retries**, so they retry safely.
- **Verification POSTs are billed and have no idempotency key.** They are never retried after a response was
  received or after a timeout; the SDK retries them only if the connection failed before any response arrived.
  Passing an explicit `idempotencyKey` to any other POST also enables retries for it.

## Pagination

```ts
for await (const entry of client.logs.listAll({ service: 'estamp' })) console.log(entry.id);
const page = await client.logs.list({ limit: 50 }); // page.items, page.nextCursor
for await (const d of client.webhooks.events.listAll()) {
  /* ... */
}
```

## Webhooks

Deliveries carry `X-Webhook-Signature`, `X-Webhook-Timestamp` (Unix seconds) and `X-Webhook-Event-Id`. The
signature is hex `HMAC-SHA256(secret, `${timestamp}.${rawBody}`)`. Always verify against the **raw** body.
Stale timestamps (default tolerance 300s) are rejected; comparison is constant-time.

```ts
// Edge runtimes, Next.js, Node 18+ (async, WebCrypto)
import { constructEventFromHeaders } from '@stampmitra/sdk/webhooks';
const event = await constructEventFromHeaders(rawBody, request.headers, secret);

// Synchronous Node variant
import { verifySignature, constructEvent } from '@stampmitra/sdk/webhooks-node';
const ok = verifySignature(rawBody, timestampHeader, signatureHeader, secret); // boolean
```

`verifySignature` returns a boolean and never throws on bad input; `constructEvent` throws
`WebhookSignatureError` (`reason`: `malformed | stale | mismatch`). The main entry also exports the async
`verifySignature`/`verifySignatureAsync`. See `examples/` for Express, Next.js and Cloudflare Workers.

## Client-side validation

Inputs are trimmed, upper-cased and checked locally against the API's formats (PAN, GSTIN, IFSC, CIN, Udyam,
vehicle number, 9-18 digit bank account, passport file number, driving licence, voter ID, `YYYY-MM-DD` dates, name
length). Invalid input throws `ValidationError` (`local: true`) with no network call and no billing. Disable with
`validateInput: false`.

## Safe logging

Nothing is logged by default. Pass `logger: { debug(msg, meta) {} }` to receive request/response records with
`Authorization`/`x-api-key` redacted and PAN/GSTIN/account numbers/names masked.

## Development

```sh
npm ci && npm run lint && npm run typecheck && npm test && npm run build
npm run coverage:spec   # fails if any METHOD+path in spec/openapi.json has no SDK method
```

`npm test` also runs `test/conformance/`, which drives every operation over real HTTP against the
[spec repo's mock server](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-openapi). Point
`STAMPMITRA_SPEC_DIR` at a checkout of that repo to enable it (it is skipped when unset, required in CI).
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Links

[Node SDK page](https://developer.stampmitra.in/sdks/node) | [Docs](https://developer.stampmitra.in/docs) |
[OpenAPI](https://developer.stampmitra.in/openapi.json) | [Contributing](CONTRIBUTING.md) |
[Security](SECURITY.md) | [Changelog](CHANGELOG.md) | [License (MIT)](LICENSE)
