# Verification

Use Node 24 and `npm ci`. Turnli uses Node's built-in test runner (no Vitest or Python stack), Playwright with Chromium, TypeScript, JavaScript syntax lint and the Next.js production build.

## Canonical commands

- `npm run verify`: route type generation, typecheck, syntax lint and all fast unit/domain tests. No database or external credentials needed.
- `npm run verify:full`: the fast checks, isolated PostgreSQL integration tests, production build and critical desktop/mobile Playwright journeys, each once. Run before a checkpoint/release or after changes spanning boundaries.
- `npm run test:unit -- tests/authorization.test.cjs`: focused unit files. `npm test` is the whole unit suite, excluding opt-in integration files.
- `npm run test:integration`: all persistence tests, with every migration applied to a new disposable schema. Append specific `tests/*.integration.test.cjs` paths for a focused database check.
- `npm run test:e2e:critical`: existing tests tagged `@critical`; requires a current production build.
- `npm run test:e2e -- tests/e2e/cleaner-ux.spec.ts`: targeted browser checks. The unfiltered browser suite remains available for deliberate broader regression work.

`lint` checks JavaScript/CJS syntax; TypeScript's compiler checks TS/TSX syntax and types. There is no ESLint ruleset. `typecheck` generates Next route types first, so it works on a fresh checkout before a production build. Do not run typecheck again through lint or repeat successful checks without a relevant change.

## Local test database and browser

Start an **isolated** PostgreSQL 16 service:

```sh
docker run --rm --name turnli-test-postgres -p 127.0.0.1:55432:5432 -e POSTGRES_USER=turnli_test -e POSTGRES_PASSWORD=turnli_test -e POSTGRES_DB=turnli_test postgres:16
```

In another terminal:

```sh
npx playwright install chromium
npm run verify:full
```

Stop the container with `docker stop turnli-test-postgres`. Alternatively supply a local PostgreSQL server with the same test-only database/user/password. `TURNLI_TEST_PG_PORT` may change the local port; hosts, credentials and database names are intentionally not configurable. A local Chrome executable can be selected with `PLAYWRIGHT_EXECUTABLE_PATH`.

Never load `.env.local` for tests. The canonical verification runner blanks application credentials, disables the old integration flag for fast checks, and supplies fresh process-local encryption keys only to isolated tests. It ignores `DATABASE_URL`. Database tests refuse the old `TURNLI_TEST_DATABASE=1 node --env-file=.env.local ...` path without an isolated schema. A failed/unavailable database fails verification rather than silently skipping persistence checks.

The test-only `pg` adapter executes the **existing store SQL** on PostgreSQL, including real locks, triggers, constraints and transactions. Batched statements use a single client with BEGIN/COMMIT/ROLLBACK. It changes only the test-process transport; production continues using Neon's HTTP driver. Each run creates and drops a randomly named schema and never migrates production or `public`. Tests also clean up their synthetic rows. Abrupt process termination may leave a schema in the disposable database; removing the container removes it.

This verifies PostgreSQL semantics, not Neon HTTP transport or production connectivity. Live-provider checks remain separate operational work and must not use production mutation tests.

## Critical browser coverage

The existing `@critical` journeys cover public registration/login entry, signup verification failure/retry, server-authorised Host routing and role denials, Cleaner-owned customer setup, mocked Host invitations, Cleaner acceptance, automatically shared calendars, the correct persisted job checklist, Start Guide, issue reporting, 3–6 completion photos, submission and Host approval/issue review. Real HTTP denial checks supplement mocked UI data. Run these on desktop and mobile Chromium.

Automatic turnover generation, calendar changes/cancellation, assignment/revocation, persistence and immutable history are verified by SQL integration tests. Browser fixtures show synthetic turnover jobs; they do not prove database generation. Avoid duplicating these deterministic assertions with extra UI tests.

The browser server uses ephemeral signed tokens and a local Descope-compatible transport. APIs that would require database data are explicitly mocked in journey tests. Database credentials and delivery credentials are blank; no real invitations or feeds are used. No production authentication bypass is added.

## CI

`.github/workflows/verify.yml` runs on pull requests and pushes to main: cached npm install → fast checks → PostgreSQL service integration → production build → critical Playwright journeys. One job avoids duplicate installs/builds; superseded runs are cancelled. Only read access to repository contents is granted. Browser failure traces/reports expire after seven days and contain synthetic test data only.

No GitHub production secrets or Vercel metadata are required. Repository maintainers can make the `verify` job a required branch-protection check after the workflow is pushed and its first run succeeds.
