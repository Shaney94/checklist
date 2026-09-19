# Completed frontend architecture migration

Turnli's login and authenticated dashboard now use Next.js App Router, React and
strict TypeScript. The migration keeps the existing design, CSS, routes/history,
workspace APIs and domain rules. No Start Guide, completion/photo, notification,
payment or new role features are included.

## Structure

- `src/app/app/page.tsx`: authenticated dashboard page. The Node proxy uses the
  existing Descope `currentUser` verifier before allowing `/app`, retaining cookie
  refresh headers and redirect/error behaviour. No client-supplied identity is used.
- `src/features/dashboard`: shell, mobile navigation, reminders, account dialogs,
  property setup, workspace checklists/FAQs and original-workspace tools.
- `src/features/calendar`: typed reservation lane calculation, calendar renderer,
  management and existing API-backed filtering/sync/seen/subscription actions.
- `src/components/Dialog.tsx`: native modal focus, Escape and return-focus handling.
- `src/app/api`: Node route handlers adapting existing backend handlers.
- `lib/*.cjs`: retained Descope, Neon, workspace, iCal, sync and encryption logic.

There is one frontend implementation. Superseded vanilla dashboard/calendar
scripts, public CSS copies and executable private HTML templates were removed
only after React functional checks and legacy layout comparisons passed.
The same styles now live under `src/features/dashboard` and are bundled by Next.

## Private content and isolation

The original workspace's complete checklist sections, FAQ rich text, reminders
and host contact are now structured data encrypted in
`private/cleaning-content.enc`, using the existing content key and encryption
format. No private values were copied into React source or public assets.
`/api/dashboard-bootstrap` authenticates first, decrypts only for the original
workspace and returns no-store JSON. New workspaces receive `content: null`.
React renders allowed rich-text elements; no legacy HTML or JavaScript executes.
Workspace checklist progress still uses the same Neon document and API actions.

The ignored editable source is `.private/cleaning-content.json`. Existing
seal/unseal scripts now work with this JSON. No database migration or new provider
configuration is required. Existing content-key backups remain necessary.

## Compatibility that remains

- `src/server/route-adapter.ts` temporarily adapts the tested CommonJS handlers to
  Web Request/Response, preserving cookies, status, body limits and binary exports.
  The handlers/domain layer are reused intentionally, not duplicated.
- `/api/app` redirects old links to `/app`; it no longer renders any frontend.
- Existing `legacy-progress` fields/actions remain supported for original-workspace
  persisted checklist progress. They are data compatibility, not legacy UI code.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then
`npm run test:e2e` (Chromium or `PLAYWRIGHT_EXECUTABLE_PATH`). Node tests continue to
cover domain and security behaviour; layout tests now exercise the typed algorithm.
The small browser suite covers auth, calendar/management, tools/history and original
versus empty-workspace behaviour on desktop/mobile. Authenticated tests use signed
synthetic JWTs and a test-process-only Descope transport. Workspace/calendar HTTP
responses are fixtures; no production accounts, messages or database writes occur.
No test bypass or fixture route is included in the application.

Before removal, legacy and React dashboard geometry matched within two pixels for
header, calendar, month toolbar, date rows and navigation at desktop/mobile widths.
Original checklist data and encrypted JSON round-trip equality were checked locally.
Live-provider delivery and production authenticated verification are separate from
these local tests. No commit, push or deployment is performed by this migration.
The earlier `turnli-migration.patch` is a historical export and is now outdated.
