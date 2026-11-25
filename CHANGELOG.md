# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/) (pre-1.0: minor versions may contain breaking changes).

## [Unreleased]

### Changed

- Documentation only: one Service wallet (kept under the service-fee-wallet name for compatibility) for verification calls and e-Stamp fees; the PAN card is mandatory to complete the stamp (an order can be placed without it).

## [0.2.0] - 2026-11-24

Targets API contract **1.2.0** (62 operations, 31 new). Pre-1.0: this minor release also contains one behaviour change (see Changed).

### Added

- e-Stamp ordering on `client.estamp`: `getStatesAvailability`, `getState`, `getStateRequirements` (with `exampleBody`),
  `listDistricts`, `listSros`, `validateOrder`, `createOrder`, `listOrders`, `listAllOrders`, `getOrder`, `cancelOrder`,
  `exportOrder`, `listOrderStamps`, `uploadOrderDocument` (multipart PAN card upload), `getStamp`, `cancelStamp`,
  `replaceStamp`, `setStampPanCard`, `getStampCertificate` and `getWallet`.
- `client.stampDutyWallet` and `client.serviceFeeWallet` (`getBalance`, `topup`, `listTransactions`, `listAllTransactions`,
  `listInvoices`, `listAllInvoices`, `getInvoice`) and `client.account` (`getBalance`, `getUsage`).
- Types for all new payloads, including `EstampStampLine`, `EstampParty` (a party may be a name string or an object),
  `EstampPropertyArea`, `EstampOrder`, `EstampValidateResult`, wallet top-ups (Stamp Duty: `baseAmount`, `gstAmount`,
  `totalCharged` are numbers, the other amounts strings; Service Fee: all strings) and account balance/usage.
- Typed error details: `StampMitraError.details`, `ValidationError.fieldErrors` (`error.details.errors[]`) and
  `PaymentRequiredError.wallet` (`STAMP_DUTY` | `SERVICE_FEE`).
- `createOrder` and `uploadOrderDocument` send an auto-generated `Idempotency-Key` when you pass none (required by the API
  for order creation).
- Retries: 409 `IDEMPOTENCY_IN_PROGRESS` is retried after `Retry-After` with the same key; `validateOrder` (a dry run) is retried.
- Conformance tests replaying every new operation's fixtures over HTTP against the spec repo's mock server;
  `spec/openapi.json`, `retry-scenarios.json` and the webhook vectors re-vendored from contract 1.2.0.

### Changed

- **Never auto-retried:** `cancelOrder`, `cancelStamp`, `replaceStamp`, `setStampPanCard`, both wallet `topup`s and
  `webhooks.events.replay`. For `replay` this is a change: it was previously retried after a connection failure that happened
  before any response, and when you passed an explicit `idempotencyKey`; it no longer is in either case.
- The README documents that the API sends `Retry-After` on 429, 503 and 409 `IDEMPOTENCY_IN_PROGRESS`; it is honoured.

### Changed

- **Idempotency/retry semantics aligned with the PHP, Go, Java and .NET SDKs.** The API honours
  `Idempotency-Key` on every metered call, so the SDK now auto-generates a CSPRNG UUIDv4 key for every `POST`
  except webhook replay (verification, duty calculation, parties, orders, payment intents) when you pass none,
  reuses it across automatic retries, and retries those POSTs on 429/502/503/504, timeouts and connection errors
  (honouring `Retry-After`, else jittered exponential backoff). Previously verification and duty `POST`s carried
  no key and were never retried after a response. A caller-supplied `idempotencyKey` still wins; webhook replay
  stays unkeyed and is never retried after a response.
- `baseUrl` must be `https` (plain `http` only for loopback); redirects are never followed; the API key is
  non-enumerable so it does not appear in `console.log`/`util.inspect` of a client.
- `Order` type reflects the API (`externalOrderId`, `createdAt`, `serviceCode`); `create-order` example fixed.

### Added

- `test/conformance/`: all 31 operations, error mapping, retry/idempotency sequences, pagination, webhook and
  validator vectors over real HTTP against the spec repo's mock server (wired into CI).

## [0.1.0] - 2026-10-16

### Added

- Initial release: `StampMitra` client with `verify`, `services`, `estamp`, `orders`, `payments.intents`,
  `usage`, `logs` and `webhooks.events` resources covering all 31 operations of the API snapshot.
- Typed errors, automatic retries with full-jitter backoff, auto `Idempotency-Key`, per-request options,
  raw-response access (`.withResponse()`), cursor auto-pagination, client-side validators, redacted debug logging.
- Webhook signature verification: WebCrypto (`@stampmitra/sdk/webhooks`) and synchronous Node
  (`@stampmitra/sdk/webhooks-node`).
- Dual ESM/CJS build with type declarations.
