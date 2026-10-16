# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/) (pre-1.0: minor versions may contain breaking changes).

## [Unreleased]

## [0.1.0] - 2026-10-16

### Added

- Initial release: `StampMitra` client with `verify`, `services`, `estamp`, `orders`, `payments.intents`,
  `usage`, `logs` and `webhooks.events` resources covering all 31 operations of the API snapshot.
- Typed errors, automatic retries with full-jitter backoff, auto `Idempotency-Key`, per-request options,
  raw-response access (`.withResponse()`), cursor auto-pagination, client-side validators, redacted debug logging.
- Webhook signature verification: WebCrypto (`@stampmitra/sdk/webhooks`) and synchronous Node
  (`@stampmitra/sdk/webhooks-node`).
- Dual ESM/CJS build with type declarations.
