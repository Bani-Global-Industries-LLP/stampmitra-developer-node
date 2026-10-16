# Contributing

Thanks for helping improve the StampMitra Node SDK.

## Setup

```sh
npm ci
npm run lint && npm run typecheck && npm test && npm run build
```

Requires Node >= 18 (CI runs 18, 20, 22).

## Guidelines

- Zero runtime dependencies. Keep the core (`src/index.ts`, `src/webhooks.ts`) free of Node-only
  imports so it works on Cloudflare Workers, Deno and Bun. Node-only code lives in `src/webhooks-node.ts`.
- Every API operation in `spec/openapi.json` needs an SDK method; `npm run coverage:spec` fails otherwise.
- Add tests for behaviour changes (mock `fetch` through the `fetch` client option).
- Never log or commit real keys, PANs or other personal data.
- Update `CHANGELOG.md` under "Unreleased".

## Pull requests

Keep PRs focused, describe the change and link any issue. By contributing you agree your work is
licensed under the MIT License.
