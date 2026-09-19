# Turnli

Turnli is a cleaning operations platform for short-term rental hosts, property managers, businesses, and cleaners.

## Product

- Use **Turnli** in user-facing content. Do not rename technical identifiers or URLs solely to correct historical branding.
- Preserve working behaviour, design-system conventions, responsiveness, integrations, and data flows unless explicitly asked otherwise.
- UI improvements are allowed when they clearly improve the requested feature; avoid unrelated redesign.
- Treat mobile and accessibility as first-class requirements.
- Keep workflows simple and operational.
- Never fabricate product, reservation, integration, or account data.
- Reservations and cleaning jobs are distinct. Scheduled checkout does not prove physical checkout.

## Data

- PostgreSQL on Neon is the source of truth for persistent application data.
- Do not use browser storage as the sole persistence mechanism for persistent domain data.
- Client storage may be used for temporary UI state and preferences.

## Security

- Enforce authentication, authorization, and workspace/property isolation server-side. UI visibility is not authorization.
- Treat iCal URLs, access information, credentials, tokens, customer data, and uploads as sensitive.
- Never commit secrets or private customer/property data.
- Do not expose sensitive data through client code, logs, feeds, notifications, or public URLs.
- Give cleaners only information required for their work.
- Never fake successful authentication, sync, notification, upload, integration, or payment states.
- On integration failure, expose an appropriate error or degraded state rather than substituting fake data.

## Calendar

- Use persisted iCal/ICS subscriptions and prevent duplicate reservations during synchronization.
- Treat multi-day reservations as one logical booking, including when visually wrapped.
- Show booking source and guest count only when reliably available.
- Do not infer literal check-in/out times from all-day iCal events. Current operational defaults may be 15:00 check-in and 10:00 checkout.

## Engineering

- Inspect relevant code and data flow before editing.
- Treat the repository as the source of truth for architecture, versions, integrations, and tooling.
- Follow existing conventions, components, and design tokens.
- Reuse existing code and make the smallest correct change.
- Avoid unrelated refactors, abstractions, renaming, or dependencies.
- Ask only when ambiguity could materially affect implementation.

## Verification

- Use the smallest relevant verification scope first.
- Add or update tests when appropriate for changed behaviour.
- Prefer focused Vitest tests for logic and component behaviour when configured.
- Use targeted Playwright tests for important user flows and E2E behaviour when configured.
- Do not run full test/E2E suites unless warranted or targeted verification is insufficient.
- Run relevant type checks, linting, and builds when configured.
- Run automated accessibility checks for affected UI when appropriate tooling is configured.
- Do not modify GitHub Actions unless the task requires CI changes.
- Fix regressions introduced by your changes.
- Never claim unverified functionality works.

## Context

- Read only documentation relevant to the task and keep completion reports concise: changed, verified, blockers.
