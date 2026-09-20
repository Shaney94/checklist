# Public SEO

The homepage and three acquisition pages use App Router metadata and server-rendered HTML. The canonical origin comes from the existing server-owned authentication configuration (`https://turnli.io`), never a request host. Existing Next.js URL normalisation redirects trailing slashes to the slashless canonical paths (except `/`). Links, Open Graph URLs and the sitemap use those same URLs.

`src/features/marketing/metadata.ts` lists the four public pages. Extend it only for useful, approved content; a future location page should have visible parent breadcrumbs under Airbnb cleaning. No location pages, matching or availability claims have been added. Host onboarding still requires the existing explicit server-managed Host role; registration does not self-assign that role. The Cleaner route uses the existing free registration/workspace flow. No enquiry collection or new marketplace flow is implied by Get started.

Root metadata remains noindex by default; only the four marketing pages opt into indexing. Authentication, API and app paths keep private/no-store and noindex response headers. Root invitation/recovery/redirect query variants retain the existing Login experience, noindex metadata/headers and no public canonical or structured data. Unknown pages remain 404/noindex. `robots.txt` permits public pages/assets and leaves login/register crawlable so crawlers can read noindex. Server authorization remains the private-data boundary.

The old all-site Vercel noindex/no-store override is removed. Next.js owns the security/indexing headers; Vercel retains the service-worker cache rule. Check response headers on the deployed domain before requesting indexing, including any project-level deployment-protection configuration outside this repository.

## Structured data and performance

The homepage describes only Organization and WebSite, using the visible Turnli name/logo. Cornerstones include BreadcrumbList matching visible breadcrumbs. There are no ratings, reviews, supply counts, geographic service-availability claims or unsupported product schemas.

Pages retain the existing nonce-based CSP, which requires request-time rendering. Content, links and metadata are delivered in HTML without waiting for client JavaScript. Only the existing menu, session link and progressive motion hydrate. No external fonts, photography, video, trackers or UI libraries were added; the existing logo has explicit dimensions. Public assets and the static sitemap/robots routes are no longer caught by blanket no-store headers. These are implementation improvements, not a claim that field Core Web Vitals pass.

## Verification and Search Console

Run `npm run verify`, then a production build and `npm run test:e2e -- tests/e2e/seo.spec.ts`. The SEO checks also run in the canonical critical/full suite. They cover raw server HTML, canonical URLs, robots/sitemap, structured data, real private-route denials, axe accessibility, keyboard navigation, reduced motion and text scaling on desktop/mobile. Existing auth and role checks remain unchanged.

After deployment:

1. In Google Search Console, add the **Domain property `turnli.io`**.
2. Copy Google's exact DNS TXT verification record into the domain's DNS provider, wait for propagation, then select Verify. No token is fabricated or stored in the application.
3. Submit `https://turnli.io/sitemap.xml` in Sitemaps.
4. Use URL Inspection → Test live URL for `/`, `/airbnb-cleaning`, `/software/airbnb-cleaning` and `/cleaners/airbnb-cleaning-jobs`. Confirm crawl access and canonicals before requesting indexing.
5. Monitor indexing, query performance and field Core Web Vitals after sufficient real traffic. Availability, rankings and Google-selected canonicals are not guaranteed by deployment.

References: [Google ownership verification](https://support.google.com/webmasters/answer/9008080), [sitemap submission](https://support.google.com/webmasters/answer/7451001), [Next.js nonce rendering](https://nextjs.org/docs/app/guides/content-security-policy#static-vs-dynamic-rendering-with-csp).
