# Public marketing and SEO

Scope: public marketing components in `features/marketing`, public search pages in `app` (including future location/content pages), and their metadata, sitemap and robots implementation. These rules do not govern authenticated Host/Cleaner functionality. Root instructions still apply.

## Search and architecture

- Follow Google Search Essentials: useful, people-first pages; no keyword stuffing, hidden SEO text, cloaking, doorway pages or scaled low-value content.
- Each indexable page needs distinct search intent and genuine user value. Do not create synonym variants or competing pages targeting substantially the same intent.
- Location pages require differentiated local value, never city-name substitutions at scale. Place them beneath `/airbnb-cleaning/` unless there is a justified information-architecture change. UK is the initial organic market; keep the architecture internationally extensible.
- Use established Next.js App Router SEO capabilities. Canonical origin is deterministically `https://turnli.io`, never request-derived. Preserve intentional trailing-slash/canonical behaviour and align crawlable HTML links and sitemap entries with it.
- Give public indexable pages intentional metadata and indexing controls. Authentication, account and private application surfaces are not search landing pages. Sitemaps contain only canonical public indexable URLs, excluding auth, private, API, callback and test routes.
- Structured data must match visible content and implemented functionality; do not add unsupported entities or claims for rich results.

## Public claims

- Position Turnli around implemented cleaning operations/software; marketplace supply is developing. Do not claim a complete property-management system or advertise future functionality as live unless implementation supports it.
- Hosts can bring an existing Cleaner; Cleaners can manage existing customers. Do not guarantee marketplace work or availability without real supporting data.
- SEO claims about ratings, reviews, customer counts, Cleaner availability, prices, locations, partnerships and service coverage require evidence; never invent them.

## Accessibility and performance

- Prefer semantic HTML over ARIA. Preserve logical headings, landmarks, keyboard access, visible focus, meaningful links, labels, alt text, contrast and responsive text scaling. SEO must not compromise accessibility.
- Protect field Core Web Vitals: target LCP ≤ 2.5s, INP < 200ms and CLS < 0.1. Do not present local measurements as field results.
- Prefer server-rendered/static public content where appropriate; minimise unnecessary client JavaScript, hydration, large dependencies, layout shift and oversized media. Preserve reduced-motion support.

## Verification

- Follow the root verification workflow. For SEO changes, check relevant metadata, canonical/indexing behaviour, parseable sitemap XML and canonical entries, robots behaviour, crawlable links and accessibility.
