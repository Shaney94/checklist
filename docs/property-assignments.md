# Property invitations and Cleaner access

Hosts invite an email from the property screen. An invitation belongs to one existing workspace/property, expires after seven days, and does not grant access until the signed-in Cleaner accepts. Acceptance uses the provider-verified email and stable user ID, never a client-supplied email or role. At most one pending/active relationship exists per property. Hosts may revoke it; Cleaners may decline a pending invitation. Creation is limited to 20 invitations per workspace/hour. Expired invitations can be revoked/replaced.

The server uses the existing Descope SDK to send an email sign-up/sign-in link. This supports existing and new Cleaner accounts without setting a password, adding tenant membership or changing roles. An exact management lookup checks an existing account's eligibility; it is never exposed as a directory. The login screen removes the token from its URL and offers explicit verification through the shared account endpoint. Descope verifies it before the usual verified-account check and secure session cookies. Property acceptance is a separate action in the Cleaner workspace. Cleaners can use the existing email-code/password flow to set their own password.

**Provider configuration:** Descope's management key must permit exact user lookup, and email Magic Link sign-up/sign-in and its email connector/template must be enabled for the project. The redirect is `https://turnli.io/?join=1`. No live external email is sent by tests. Provider failures leave a visible pending invitation with unconfirmed delivery, never a false success. The intended Cleaner can still log in with the same verified email and accept the pending invitation. Account creation, email ownership and property authorization are separate.

## Jobs and revocation

Acceptance assigns existing unassigned scheduled jobs and future jobs inherit the property Cleaner. Existing manual jobs assigned to a different Cleaner are preserved. The original private job-code workflow remains under a secondary disclosure; its explicit per-job assignment can support later overrides without a second job model.

`turnli_cleaning_jobs.property_assignment_id` links inherited assignments. A shared SQL predicate checks that relationship for every Cleaner job/checklist/guide/completion/photo access. Workspace row locks serialize acceptance, revocation and job creation. Revocation binds all this Cleaner's property jobs to the revoked relationship and bumps revisions, denying subsequent access including submitted photos. Submitted checklists/evidence remain unchanged and available to authorised Hosts; only draft photos are removed. A replacement Cleaner inherits eligible scheduled work but never the previous Cleaner's submitted evidence. Existing checklist progress on scheduled work follows the established reassignment behaviour.

The existing completion requirements remain: all applicable job tasks, 3–6 validated private photos, submit, then Host approval or issue report. Submitted evidence stays locked. Reservations never create jobs or prove physical checkout.

## Operational workspace

Active property assignments expose the Start Guide and explicitly linked, enabled calendars read-only. No scheduled job is required to view the assigned property's operational calendar/guide. Each SQL query joins the assignment, property and owning workspace. Unlinked historical feeds remain private until a Host explicitly links them; no name matching or fabricated relationship is used.

Calendar responses are an explicit operational projection: dates/times, known source, reliable guest count and property name. They exclude guest names, summaries, descriptions, raw event UIDs, feed hosts/URLs, encryption fields and calendar administration. Reservation IDs are opaque hashes. Every request rechecks authorization; responses are private/no-store. Focus/visibility/periodic revalidation clears revoked views. Already-seen content cannot be withdrawn from a person.

Cleaner-owned customer properties/calendars remain in `user:<id>` via `managedWorkspace`; assigned Host properties never appear in those administration endpoints. Hidden assigned-property IDs are an account-scoped local UI preference only. Guide/calendar/checklist domain content is not stored in browser storage.

New properties receive generic Regular/Deep cleaning task templates. Existing property lists and encrypted historical content are untouched. Hosts can mark individual property tasks not applicable without deleting the template text. New jobs snapshot applicable tasks; existing job checklists do not change. The existing line editor remains available without a builder redesign. Own-customer property lists remain manageable separately.

## Migration and verification

```sh
node --env-file=.env.local scripts/migrate-property-assignments.cjs
node --test tests/property-assignments.test.cjs tests/account.test.cjs
TURNLI_TEST_DATABASE=1 node --env-file=.env.local --test tests/property-assignments.integration.test.cjs tests/cleaning-jobs.integration.test.cjs tests/completion.integration.test.cjs
```

Migration `008-property-assignments.sql` extends 5A/5B and does not infer assignments or link historical feeds. Neon tests create synthetic records and clean them up. Desktop/mobile browser fixtures cover invitation, secure-link verification, acceptance, read-only calendar/guide, applicable checklists, revocation and Cleaner-owned tools. Real inbox delivery and a real invited-account login remain operational verification, not a claim made by these fixtures.
