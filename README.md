# Turnli Cleaning Hub

The existing HTML/CSS/JavaScript application runs on Vercel. GitHub `main` deploys to `https://turnli.vercel.app`. No framework or second bookings database is introduced.

## Build and test

Run `npm ci`, `npm test`, and `npm run build`. The build replaces the generated `public/` directory with an explicit public asset list. Vercel serves the account, calendar and private dashboard endpoints separately. GitHub Pages can only serve the public login shell; the application requires its Vercel endpoints.

## Private dashboard source

`/` is the public login page. `/app` is served by `api/app.js` only after the provider session and workspace membership are verified. The dashboard contains existing property instructions, so its versioned source is encrypted in `private/dashboard.enc`, outside the public build. The decryption key exists only in server environment variables.

To edit on a new trusted checkout, pull the Vercel development environment into ignored `.env.local`, then run:

```
node --env-file=.env.local scripts/unseal-dashboard.cjs
```

Edit the ignored `.private/dashboard.html`, then seal it before testing and committing:

```
node --env-file=.env.local scripts/seal-dashboard.cjs
npm test
npm run build
```

Never commit the plaintext dashboard or `.env` files. Keep the content key backed up in the protected Vercel environment; changing it requires resealing the content. Historic Git commits predate this protection and may still contain previously public operational information. This change does not rewrite that history or rotate external access details.

## Accounts and invitations

Descope manages email/password login, email OTP, refresh sessions and invitations. Enable Password and OTP in its API/SDK authentication settings; set its display name to **Turnli**. Configure approximately 30-day refresh sessions with short-lived session tokens in Descope. Cookies are Secure, HttpOnly and SameSite=Lax; their lifetime is capped by the provider token expiry and 30 days. Existing cookie identifiers are retained to preserve sessions. No credentials are stored in localStorage.

Only verified workspace members can open the dashboard or fetch calendar/subscription data. The existing verified owner remains the only invitation administrator. Invitations assign customers to the existing shared workspace, not independent property accounts. Password setup/reset always requires a fresh provider-verified email code. Sign out revokes the provider refresh session before clearing cookies. Private responses are no-store; browser-history restoration rechecks authentication before revealing the dashboard.

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

The authenticated calendar endpoint fetches the existing feed without persisting bookings. Reservation bars span arrival through checkout; separate cleaning markers show the turnover after checkout. Mobile uses a chronological timeline. Details include available property, guest count, source and times.

All-day `DTEND` is exclusive and denotes checkout day. Check-in/checkout times applied to all-day events are explicitly labelled property rules, not feed data or promised cleaning start times. UTC timestamps are converted to Europe/London. Unsupported recurring/timezone formats produce a visible error and retain the original embedded calendar fallback. Loading, empty, disconnected and retry states are distinct.

Subscription URLs are returned only to authenticated users, as required for Add to Calendar and Copy iCal Link. These users can share copied links; the upstream subscription remains a bearer URL. WhatsApp actions only prepare drafts for review and manual sending.

## PWA and privacy

The manifest and icons use Turnli branding. The service worker does not cache operational content. Checklist progress retains existing local storage keys. `robots.txt` and noindex settings are preserved; noindex is not a substitute for authentication.
