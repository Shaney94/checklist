# Public SEO

The homepage, three cornerstone acquisition pages and three local pages use App Router metadata and server-rendered HTML. The canonical origin comes from the existing server-owned authentication configuration (`https://turnli.io`), never a request host. The Cleaner acquisition URL retains its trailing slash: `/cleaners/airbnb-cleaning-jobs/`. Other routes retain existing slashless normalisation (except `/`). Links, Open Graph URLs and the sitemap use those same URLs.

`src/features/marketing/metadata.ts` lists the public indexable pages. Extend it only for useful, approved content; a future location page should have visible parent breadcrumbs under Airbnb cleaning. Glasgow, Edinburgh and London follow the national page’s slashless canonical convention. The national page links to all three equally; other city and borough routes remain absent. No matching engine or guaranteed availability has been added. Host onboarding still requires the existing explicit server-managed Host role; registration does not self-assign that role. The Cleaner route uses the existing free registration/workspace flow. No enquiry collection or new marketplace flow is implied by Get started.

Root metadata remains noindex by default; only the registered marketing pages opt into indexing. Authentication, API and app paths keep private/no-store and noindex response headers. Root invitation/recovery/redirect query variants retain the existing Login experience, noindex metadata/headers and no public canonical or structured data. Unknown pages remain 404/noindex. `robots.txt` permits public pages/assets and leaves login/register crawlable so crawlers can read noindex. Server authorization remains the private-data boundary.

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
4. Use URL Inspection → Test live URL for `/`, `/airbnb-cleaning`, `/software/airbnb-cleaning`, `/cleaners/airbnb-cleaning-jobs/` `/airbnb-cleaning/glasgow`, `/airbnb-cleaning/edinburgh` and `/airbnb-cleaning/london`. Confirm crawl access and canonicals before requesting indexing.
5. Monitor indexing, query performance and field Core Web Vitals after sufficient real traffic. Availability, rankings and Google-selected canonicals are not guaranteed by deployment.

References: [Google ownership verification](https://support.google.com/webmasters/answer/9008080), [sitemap submission](https://support.google.com/webmasters/answer/7451001), [Next.js nonce rendering](https://nextjs.org/docs/app/guides/content-security-policy#static-vs-dynamic-rendering-with-csp).

The Glasgow page uses the supplied £60 Regular / £130 Deep reference prices for approximately 52 m², two bedrooms and one bathroom, with supplies and linen/towel wash and dry included. These are qualified reference prices, not an online quote. Its CTA opens the shared, noindex public quote flow at `/quote`; pricing is shown before authentication, while matching remains unavailable. See [quote model and account boundary](cleaning-quotes.md). Glasgow guidance focuses on the building handover and links to official Scottish licensing information; it makes no neighbourhood coverage claims.

Edinburgh focuses on festival-period handovers, linen readiness and property-specific entry details, with links to official Edinburgh Festivals and council guidance. London focuses on travel between jobs, building entry and multi-property linen coordination, with a TfL journey-planning link. Neither guide claims local Cleaner coverage. Both use `/quote` without authentication or city-specific pricing, and the shared breadcrumb/metadata components. Local-page styling lives in `src/features/marketing/local.css`; no new client components or media are needed.
