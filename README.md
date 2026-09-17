# Turnly Cleaning Hub

Static cleaning dashboard with two small Vercel Node endpoints. GitHub `main` deploys to `https://turnli.vercel.app`.

## Build and test

- `npm ci`
- `npm test`
- `npm run build`

The build copies only public assets to `public/`. Secrets, server code and tests are excluded from that output. Vercel serves `api/calendar.js` and `api/account.js` as functions. GitHub Pages can still serve the static site; the original embedded calendar remains the fallback where these endpoints are unavailable.

## Accounts and invitations

Descope manages accounts, email codes and invitations. The only invitation administrator is the verified `s.landerson@outlook.com` account. Other users must first be invited. Account sessions use Secure, HttpOnly, same-site cookies; no management key or session token is included in client JavaScript.

Configure in Vercel for each deployment environment:

- `DESCOPE_PROJECT_ID` (provisioned by integration)
- `NEXT_PUBLIC_DESCOPE_BASE_URL` (provisioned by integration)
- `DESCOPE_MANAGEMENT_KEY` — server only, project-scoped Asset Management Read & Write.

Enable email OTP through the Descope API/SDK settings. The owner can create their account using the dashboard's Invite customers action. Customers join using the invitation link and confirm their email code.

The invitation sends through Descope's configured email template and points to `https://turnli.vercel.app/?join=1`. Set the Descope project display name to **Turnly**. For a custom **Join Turnly** email button and exact wording, configure a custom email connector/template in Descope; system email templates cannot be edited by this project's user-management key. Application sign-in does not change the existing access model of the public cleaner hub or create separate customer property dashboards.

Never commit `.env` files, include the management key in public variables, or use real customer addresses in automated tests. Unit tests stub sends. An inbox/OTP check is needed to confirm actual email delivery and join completion.

## Calendar and WhatsApp

`/api/calendar` fetches the existing fixed TurnCal iCal feed without persisting bookings. Native turnover dates come from reservation checkout (`DTEND`); they are not promised cleaner start times. UTC times are converted to UK time; unsupported event formats open the original embedded calendar. Guest names and reservation codes are omitted from the native API response.

The issue-report and unavailable-clean actions open a WhatsApp draft for `+447773333455`. They never send messages automatically.

## PWA and privacy

The manifest and icons use the existing logo and the name Turnly. iPhone users can use Safari's Add to Home Screen. The service worker does not cache the dashboard or calendar; it supplies a generic offline message only. Checklist progress continues to use the existing local storage keys.

`robots.txt` and the existing noindex metadata must remain unchanged. The CSP permits same-origin API connections; no third-party authentication scripts run in the dashboard.
