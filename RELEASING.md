# Releasing

Releases are published to npm from GitHub Actions with **trusted publishing / provenance** (OIDC, no
long-lived token). The publish job is inert until a maintainer enables it.

## One-time setup

1. On npmjs.com, create the `@stampmitra` scope/org and, for the `@stampmitra/sdk` package, add a
   **Trusted Publisher** pointing at this repository and the workflow file `release.yml`
   (alternatively, publish the first version manually with `npm publish --access public`, then configure it).
2. In this repo: Settings -> Secrets and variables -> Actions -> Variables, add
   `NPM_PUBLISH` = `true`.

## Cutting a release

1. Update `CHANGELOG.md` and bump `version` in `package.json` and `src/version.ts` (a test checks they match).
2. Commit, then `git tag vX.Y.Z && git push --tags`.
3. The workflow builds, tests, and (only if `NPM_PUBLISH == 'true'`) runs
   `npm publish --provenance --access public`.
