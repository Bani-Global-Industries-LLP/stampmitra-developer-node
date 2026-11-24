# @stampmitra/sdk

[![npm](https://img.shields.io/npm/v/@stampmitra/sdk)](https://www.npmjs.com/package/@stampmitra/sdk)
[![CI](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Bani-Global-Industries-LLP/stampmitra-developer-node/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Official Node.js / TypeScript SDK for the [StampMitra Developer API](https://developer.stampmitra.in/docs):
Indian identity verification (PAN, GSTIN, RC, Voter ID, Driving Licence, Passport, CIN, Udyam, bank account)
and e-Stamp. Zero runtime dependencies, dual ESM/CJS, fully typed.

> **Status: pre-1.0 (0.2.0).** The API surface may change in minor releases until 1.0. The npm badge
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

| Namespace                 | Methods                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.verify`           | `pan`, `gstin`, `rc`, `voterId`, `drivingLicense`, `passport`, `cin`, `udyam`, `panToGstin`, `panToUdyam`, `bankAccount`                                                                                                                                                                                                                                                                                                                                              |
| `client.services`         | `list`, `get`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `client.estamp`           | catalogue: `getSchema`, `listStates`, `getStatesAvailability`, `getState`, `getStateRequirements`, `listDistricts`, `listSros`, `listInstruments`, `listArticles`, `calculateDuty`, `addParties`; orders: `validateOrder`, `createOrder`, `listOrders`, `listAllOrders`, `getOrder`, `cancelOrder`, `exportOrder`, `listOrderStamps`, `uploadOrderDocument`; stamps: `getStamp`, `cancelStamp`, `replaceStamp`, `setStampPanCard`, `getStampCertificate`; `getWallet` |
| `client.orders`           | `create`, `get`, `getStatus`, `getPayment`, `listDocuments`, `getDocumentDownload` (orders are addressed by your `externalOrderId`)                                                                                                                                                                                                                                                                                                                                   |
| `client.payments.intents` | `create`, `get`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `client.stampDutyWallet`  | `getBalance`, `topup`, `listTransactions`, `listAllTransactions`, `listInvoices`, `listAllInvoices`, `getInvoice`                                                                                                                                                                                                                                                                                                                                                     |
| `client.serviceFeeWallet` | the same seven methods                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `client.account`          | `getBalance`, `getUsage`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `client.usage`            | `summary`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `client.logs`             | `list`, `listAll`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `client.webhooks.events`  | `list`, `listAll`, `replay`                                                                                                                                                                                                                                                                                                                                                                                                                                           |

That is all 62 operations of the API (contract 1.2.0). Examples:

```ts
// Verification (POST /v1/verify/*). Every call, including negative results, is billed.
// Auto-keyed with an Idempotency-Key and retried safely (see Retries and idempotency).
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

## e-Stamp

The typed order flow: validate, create (with an idempotency key), upload the payer's PAN card, list the stamps,
fetch the certificate. A runnable version is in [`examples/estamp-order.ts`](examples/estamp-order.ts).

```ts
import { readFile } from 'node:fs/promises';
import { StampMitra, PaymentRequiredError, ValidationError } from '@stampmitra/sdk';

const client = new StampMitra();

const body = {
  reference: 'lease-2026-0412',
  stamps: [
    {
      clientReference: 'line-1',
      state: 'MH',
      articleCode: 'ART1', // from client.estamp.listInstruments('MH')
      denomination: 500,
      stampDutyPayer: 'FIRST_PARTY',
      firstParty: { name: 'Jane Doe', address: '12 MG Road, Pune' }, // a bare name string also works
      secondParty: 'John Smith',
      propertyArea: { unit: 'Square Feet', value: 850 },
    },
  ],
};

// 1. Dry run: nothing is saved or charged. `quote` holds the priced totals (never recalculate them).
const check = await client.estamp.validateOrder(body);
if (!check.valid) throw new Error(JSON.stringify(check.errors));

// 2. Create. An Idempotency-Key is REQUIRED by the API; the SDK generates one if you pass none. For an
//    order that spends money, derive it from something stable you own and persist it before sending.
let order;
try {
  order = await client.estamp.createOrder(body, { idempotencyKey: 'lease-2026-0412-v1' });
} catch (err) {
  if (err instanceof PaymentRequiredError)
    console.error('Top up the wallet:', err.wallet); // STAMP_DUTY | SERVICE_FEE
  else if (err instanceof ValidationError) console.error(err.fieldErrors); // [{ field, code, message, index }]
  throw err;
}

// 3. Optional: the payer's PAN card (PDF, JPEG or PNG, up to 10 MB), as multipart/form-data.
await client.estamp.uploadOrderDocument(order.id, {
  file: new Blob([await readFile('pan.pdf')], { type: 'application/pdf' }),
  fileName: 'pan.pdf',
});

// 4. The stamps of the order, then a certificate once it has been delivered.
const { items } = await client.estamp.listOrderStamps(order.id);
const cert = await client.estamp.getStampCertificate(items[0]!.id);
if (cert.available) console.log(cert.certificateNumber, cert.downloadUrl); // download promptly (5 minutes)
```

Notes:

- **The PAN card is advisory.** It never blocks an order. Send `panCardImage` (an https link) on a stamp line, upload
  the file with `uploadOrderDocument`, or send a link later with `setStampPanCard(stampId, { panCardImage })` (answers
  202; read `panCard.status` from `getStamp`).
- **Parties.** `firstParty` and `secondParty` take a name string or an `EstampParty` object
  (`name`, `address`, `phone`, `fatherHusbandName`, `gender: 'MALE' | 'FEMALE' | 'OTHER'`). Use the object when
  the state wants an address or a father's/husband's name (`getState`, `getStateRequirements` tell you).
- **Limits.** One order covers one state; up to 5000 stamp lines; `quantity` up to 1000 per line.
  `propertyArea` is `{ unit: 'Square Feet' | 'Square Yard' | 'Square Meters' | 'Not Applicable', value }`.
  `getStateRequirements(state, { articleCode, denomination, category })` returns an `exampleBody` you can send to
  `validateOrder`.
- Orders are created pending review (`status` is a pre-placement status such as `PENDING_REVIEW`). Cancel with
  `cancelOrder` / `cancelStamp`; a 409 means it can no longer be cancelled.
- Pass `idempotencyKey` yourself for `createOrder`. A key the SDK generates is reused across its own automatic retries,
  but a second `createOrder` call made by you after an unknown outcome would get a new key; use `listOrders` (your
  `reference` is on each order) to resolve an unknown outcome.

### Wallets

Orders debit two prepaid wallets: the **Stamp Duty Wallet** (statutory duty) and the **Service Fee Wallet**
(procurement and API charges, net of GST). `client.estamp.getWallet()` reads both; `client.stampDutyWallet` and
`client.serviceFeeWallet` have `getBalance`, `topup`, `listTransactions`, `listInvoices` and `getInvoice`. Balances
are decimal strings: parse them. Wallet routes need wallet scopes on your key (ask support if you get 401/403).

```ts
const t = await client.stampDutyWallet.topup({ baseAmount: 1000 });
// Checkout the Razorpay order t.razorpayOrderId, charging t.totalCharged.
console.log(t.processingFeeAmount, t.gstAmount, t.totalCharged, t.creditAmount);
```

A Stamp Duty top-up adds a 6% processing fee on top, plus 18% GST on that fee; the wallet is credited the amount you
add (`creditAmount`), and a GST tax invoice for the fee is available from `stampDutyWallet.listInvoices()` /
`getInvoice(topupId)`. Fees can change: show your payer the figures from the response and do not compute them in
your code. In a Stamp Duty top-up response `baseAmount`, `gstAmount` and `totalCharged` are JSON numbers while
`processingFeePercent`, `processingFeeAmount` and `creditAmount` are strings; Service Fee top-up amounts are all
strings. `client.account.getBalance()` / `getUsage()` read your verification wallet balance and usage.

## Error handling

All errors extend `StampMitraError` (`status`, `code`, `message`, `requestId`, `raw`, `details`).

| HTTP                      | Class                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 400 / 422                 | `ValidationError` (`field`, `fieldErrors`: `error.details.errors[]` items `{ field, code, message, index }`) |
| 401                       | `AuthenticationError`                                                                                        |
| 402                       | `PaymentRequiredError` (`wallet`: `STAMP_DUTY` or `SERVICE_FEE` on e-Stamp order creation)                   |
| 403                       | `PermissionError` (server message verbatim, e.g. IP allowlist required)                                      |
| 404                       | `NotFoundError`                                                                                              |
| 409                       | `ConflictError`                                                                                              |
| 429                       | `RateLimitError` (`retryAfter` seconds, when the server sends it)                                            |
| 5xx                       | `UpstreamError`                                                                                              |
| network / timeout / abort | `ConnectionError` / `TimeoutError` / `RequestAbortedError`                                                   |

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

- Default `maxRetries: 2`, exponential backoff with full jitter (base 0.5s, cap 8s). `Retry-After` (seconds) is honoured
  on 429, 503 and 409 `IDEMPOTENCY_IN_PROGRESS` (capped at 60s per wait); the jittered backoff applies when it is absent.
- Retried: 429, 502, 503, 504, 409 `IDEMPOTENCY_IN_PROGRESS` (keyed requests only), connection errors and timeouts.
  Any other 409 is a state conflict and is never retried.
- `GET` is always retry-safe. `estamp.validateOrder` is a dry run (no key, nothing charged) and is retried too.
- **Never auto-retried:** `estamp.cancelOrder`, `estamp.cancelStamp`, `estamp.replaceStamp`, `estamp.setStampPanCard`,
  both wallets' `topup`, and `webhooks.events.replay`. They are not auto-keyed either; a 429's `retryAfter` is on the error.
- **Every other `POST`** (all verification calls, `estamp.calculateDuty`, `estamp.addParties`, `estamp.createOrder`,
  `estamp.uploadOrderDocument`, `orders.create`, `payments.intents.create`) automatically sends an `Idempotency-Key` (CSPRNG UUIDv4) when you
  do not pass one, and **reuses the same key across automatic retries**. The API honours the key on every metered
  call, so a retried verification is replayed rather than billed twice. A key you pass as `idempotencyKey` always wins.
- A multipart upload is re-built (the whole file re-sent) on every retry, with the same key.

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

## Pricing

The SDK is free and MIT-licensed. You pay only for successful API calls, from one prepaid wallet. Sandbox is free: mock data on every endpoint, and it never debits your wallet.

Per-call rates by plan, in rupees, excluding 18% GST:

| Product                                                                                  | Pay-as-you-go | Growth | Scale | Startup | Enterprise |
| ---------------------------------------------------------------------------------------- | ------------- | ------ | ----- | ------- | ---------- |
| Standard verification (PAN, GSTIN, Voter ID, Driving Licence, CIN, Udyam, cross-lookups) | ₹5            | ₹4     | ₹3.50 | ₹4      | Custom     |
| Passport and Vehicle RC                                                                  | ₹9            | ₹8.50  | ₹8    | ₹8.50   | Custom     |
| Bank account (penny-drop)                                                                | ₹4            | ₹4     | ₹4    | ₹4      | Custom     |
| e-Stamp API fee (StampMitra's charge only)                                               | ₹5            | ₹4     | ₹3    | ₹4      | Custom     |

|                               | Sandbox   | Pay-as-you-go | Growth       | Scale          | Startup                               | Enterprise |
| ----------------------------- | --------- | ------------- | ------------ | -------------- | ------------------------------------- | ---------- |
| Plan fee                      | Free      | ₹0 / month    | ₹999 / month | ₹4,999 / month | Free for 6 months, then 50% off for 6 | Custom     |
| Seats / API keys / webhooks   | 1 / 2 / 1 | 3 / 5 / 3     | 10 / 20 / 10 | 25 / 50 / 25   | 10 / 20 / 10                          | Custom     |
| Requests per minute           | 20        | 60            | 300          | 1,000          | 300                                   | Custom     |
| Log retention                 | 7 days    | 30 days       | 90 days      | 365 days       | 90 days                               | Custom     |
| IP allowlisting               | No        | No            | Yes          | Yes            | Yes                                   | Yes        |
| White-label and custom domain | No        | No            | No           | Yes            | No                                    | Yes        |

Growth and Scale are also available yearly (₹9,990 and ₹49,990, two months free). There are separate Startup and NGO programmes. Plans, rates and limits can change, and [developer.stampmitra.in/pricing](https://developer.stampmitra.in/pricing) is the source of truth; see it for how an e-Stamp order is priced in total.

API e-Stamp orders are charged per paper as a procurement charge plus an API charge (ex-GST); see the pricing page for current rates.

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
