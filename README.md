# Turnli Cleaning Hub

Turnli now runs through Next.js App Router on Vercel. The login, authenticated dashboard and calendar UI use React/TypeScript, reusing the existing backend/domain logic. GitHub `main` deploys to `https://turnli.vercel.app`. Reservation snapshots still derive from the subscribed iCal feeds. See [migration status](docs/next-migration.md).

## Build and test

Use Node 24. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Use `npm run dev` for development or `npm start` after a production build. The asset preparation step replaces generated `public/` with an explicit asset allowlist; Next builds the routes into `.next/`. `npm run test:e2e` tests a production build with synthetic account responses (install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_EXECUTABLE_PATH` to a local Chrome binary). The application requires a Node/Next deployment; GitHub Pages cannot serve it.

## Private dashboard source

`/` is the public login page. `/app` is a React page guarded by the existing session verifier in the Node proxy. Original-workspace content is loaded through the authenticated, no-store `/api/dashboard-bootstrap` endpoint. Its structured data is encrypted in `private/cleaning-content.enc`, outside the public build. The decryption key exists only in server environment variables.

To edit on a new trusted checkout, pull the Vercel development environment into ignored `.env.local`, then run:

```
node --env-file=.env.local scripts/unseal-dashboard.cjs
```

Edit the ignored `.private/cleaning-content.json`, then seal it before testing and committing:

```
node --env-file=.env.local scripts/seal-dashboard.cjs
npm test
npm run build
```

Never commit the plaintext dashboard or `.env` files. Keep the content key backed up in the protected Vercel environment; changing it requires resealing the content. Historic Git commits predate this protection and may still contain previously public operational information. This change does not rewrite that history or rotate external access details.

## Accounts and invitations

Descope manages email/password login, email OTP, refresh sessions and invitations. Enable Password and OTP in its API/SDK authentication settings; set its display name to **Turnli**. Configure approximately 30-day refresh sessions with short-lived session tokens in Descope. Cookies are Secure, HttpOnly and SameSite=Lax; their lifetime is capped by the provider token expiry and 30 days. Existing cookie identifiers are retained to preserve sessions. No credentials are stored in localStorage.

Only verified accounts can open their own dashboard or fetch their workspace’s calendar/subscription data. Existing property instructions remain limited to the original workspace members. The existing verified owner remains the only invitation administrator. Invitations assign customers to the existing shared workspace, not independent property accounts. Password setup/reset always requires a fresh provider-verified email code. Sign out revokes the provider refresh session before clearing cookies. Private responses are no-store; browser-history restoration rechecks authentication before revealing the dashboard.

Configure these **server-side** variables in Vercel:

- `DESCOPE_PROJECT_ID`
- `NEXT_PUBLIC_DESCOPE_BASE_URL` (existing integration name, used server-side)
- `DESCOPE_MANAGEMENT_KEY` — project-scoped Asset Management Read & Write
- `TURNLI_TENANT_ID` — the shared workspace tenant
- `TURNLI_CONTENT_KEY` — 32-byte base64 encryption key
- `TURNLI_ICAL_URL` — existing private TurnCal feed
- `TURNLI_PROPERTY_NAME`
- `TURNLI_CHECKIN_TIME` and `TURNLI_CHECKOUT_TIME` — configured UK property rules in HH:mm format

OTP requests expose useful failures, apply a 60-second resend cooldown, and respect provider rate limiting. Only provider error codes/statuses are logged, never credentials or email contents. The standard Descope email sender/template is retained. An API success confirms provider acceptance, not inbox delivery; end-to-end delivery and password confirmation require the account holder. This management key cannot inspect/change authentication or email-connector settings.

## Booking calendar

The calendar endpoint reads persisted, sanitized reservation snapshots refreshed from each subscribed feed. Reservation bars span arrival through checkout; separate cleaning markers show the turnover after checkout. Mobile retains continuous multi-day reservation bars. Details include available property, guest count, source and times.

All-day `DTEND` is exclusive and denotes checkout day. Check-in/checkout times applied to all-day events are explicitly labelled property rules, not feed data or promised cleaning start times. UTC timestamps are converted to Europe/London. Unsupported recurring/timezone formats produce a visible error and retain the original embedded calendar fallback. Loading, empty, disconnected and retry states are distinct.

Subscription URLs are returned only to authenticated owners/workspace members, as required for Add to Calendar and Copy iCal Link. These users can share copied links; the upstream subscription remains a bearer URL. WhatsApp actions only prepare drafts for review and manual sending.

## PWA and privacy

The manifest and icons use Turnli branding. The service worker does not cache operational content. Checklist progress remains persisted in the authenticated workspace. `robots.txt` and noindex settings are preserved; noindex is not a substitute for authentication.

## Registration and workspace isolation

The login page offers Create an account separately from email-code login. Descope password signup is followed by email OTP verification; no application session cookie is issued until verification succeeds. Existing accounts can still use password or email-code login. Sign out is in Account and revokes the Descope refresh session.

New verified accounts use a private workspace keyed by Descope user ID. They receive a safe, empty calendar dashboard (`content: null`), not the original property's checklists, instructions or external calendar. Existing invited members retain the original shared organisation workspace. All subscription queries and mutations are scoped server-side to the workspace derived from the verified provider identity; client-provided owner IDs are never used.

## Persistent calendar subscriptions

Neon Postgres (the `turnli-calendars` Vercel integration) stores `turnli_calendars`. Run `node --env-file=.env.local scripts/migrate-calendars.cjs` on a trusted checkout before deploying to a new environment. The existing live feed was migrated once; deleting it does not silently reimport it.

Each subscription stores a stable UUID, owner, display name, source, enabled state, operational times, timestamps, sync status and sanitized reservation snapshot. Feed URLs are AES-256-GCM encrypted with a key derived from `TURNLI_CONTENT_KEY` and authenticated against the owner ID. Preserve that key with the database backup. The database credential (`DATABASE_URL`) and `CRON_SECRET` are server-only environment variables. A URL hash prevents connecting the identical feed twice within a workspace.

Manage calendars supports validated connection, details/rename, operational times, pause, refresh and removal. Removal deletes the subscription and its snapshot, not bookings at the source. A searchable property selector appears for multiple calendars; large workspaces initially select one property. Add to Calendar/Copy iCal Link require a selected property if more than one subscription exists; these explicit actions are the only API responses that reveal its private bearer URL.

The scheduled endpoint `/api/cron/calendars` runs daily at `0 5 * * *` (05:00 UTC, within Vercel Hobby's scheduling window), authenticated with `CRON_SECRET`. The account's current Hobby plan supports daily jobs, not frequent automatic polling. Manual Refresh calendars remains available with an atomic five-minute per-feed cooldown. Browser visits read saved snapshots and do not repeatedly fetch external feeds. Cron processes due calendars in bounded concurrent batches, with a time budget; backlogged rows remain eligible for the next run. Higher-volume workspaces may need a more frequent schedule/queue and hosting plan.

Sync replaces each successful calendar snapshot atomically, using hashed iCal UIDs as stable reservation identities. Repeated UIDs are deduplicated; conflicting duplicates fail rather than arbitrarily selecting a booking. Updated events replace prior data; cancelled or omitted events disappear after a successful full-feed parse. Errors preserve the last successful snapshot and record a visible sync error. Database leases prevent simultaneous syncs and stale writes after settings changes/removal. Calendars are isolated from each other, including when UIDs match.

Feed fetching permits HTTPS with public DNS/IP destinations only, pins the resolved address for the TLS request, revalidates redirects, and bounds time, redirect count and response size. URLs and upstream response details are not logged. Guest names/summary text are excluded from persisted snapshots and API responses. Guest counts are parsed only when supplied in the feed summary/description. Property-rule times apply only to date-only events. Cleaning markers indicate a turnover after checkout; they do not invent a confirmed cleaning duration. Existing host-contact actions apply only to the original property's calendar.

Optional real-database regression test:

```
node --env-file=.env.local scripts/verify-calendar-persistence.cjs
```

It creates isolated synthetic test records, tests changed source content through the actual parser/sync/store/API path (including future bookings, duplicates, cancellations, failures, ownership and deletion), then removes only its test records. Ordinary `npm test` uses no network or real customer accounts. Real inbox signup/password verification remains a separate account-holder test.
