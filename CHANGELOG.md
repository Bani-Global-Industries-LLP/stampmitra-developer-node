# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/) (pre-1.0: minor versions may contain breaking changes).

## [Unreleased]

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
