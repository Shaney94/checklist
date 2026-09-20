# Core Cleaner workflow

## Planned reservation turnovers

Migration 009 adds reservation provenance to the existing cleaning-job table, plus private job issues and a small metadata-only event journal. It does not create another property, job or assignment model.

A database reconciliation function runs atomically after calendar booking/link/checkout-rule writes and property-assignment state transitions. Existing calendar connect, successful sync, cron sync, delete and assignment acceptance/revocation therefore share the same behavior. The canonical workspace row lock serializes reconciliation with existing job creation and property-assignment changes.

Eligibility requires a calendar explicitly linked to an existing property in its owning workspace and an active property assignment. New jobs are Regular cleans planned on or after today's London date, after the reservation's scheduled checkout (or the configured all-day checkout rule). Scheduled checkout never proves the guest has left. Historical stays are not backfilled. Unlinked legacy feeds are not guessed. Cleaner-owned customer calendars do not create Host assignments or grant access.

The unique identity is workspace + property + hashed reservation UID. Mirrored feeds with the same UID share a job; when present in several feeds, the latest successful calendar supplies the operational dates. Feeds assigning different UIDs to the same stay cannot safely be deduplicated by dates alone. Manual jobs have no reservation identity and remain independent; an existing manual clean is not silently claimed as a turnover.

An untouched planned job follows date/time changes and the current property assignment. Revoking that assignment removes Cleaner access but keeps active-reservation work planned; the Host sees Awaiting Cleaner assignment until a new invitation is accepted. Reservation presence is checked independently of assignment eligibility. An explicitly cancelled reservation cancels its untouched plan without deleting it. A reservation missing from a complete feed is retained with a visible sync warning until a second successful refresh confirms the absence. Truncated feeds and partial iCalendar message methods are rejected; failed refreshes never confirm removal. Reappearance can restore an automatically cancelled plan with the same identity. Explicit Host cancellation is not automatically undone. Pausing a feed or a failed sync retains the last saved plan; pause/failure is not evidence of cancellation.

Any checked task, completion photo or reported issue counts as started work. Reservation changes/removal then flag the job for Host attention and retain its date, task snapshot and saved work. Submitted/reviewed jobs and their evidence remain immutable. No second automatic job replaces completed history. Hosts can explicitly schedule additional work if needed. Automatic jobs follow property assignment; the private-code reassignment path remains available for manual jobs.

## Recovered checklists

The `REGULAR` and `DEEP` task arrays in `b7f9e98:index.html` exactly match `3023f80:index.html` and `3e78f80:index.html`: 38 Regular tasks in six groups and 109 Deep tasks in eleven groups. Only those task arrays were recovered. Separate access notes were not copied. Six task strings were minimally adapted: direct-text reporting became in-app reporting, two laundry-bag location instructions and three equipment-location descriptions were removed from reusable tasks. Other established task content is retained, with group names prefixed to each task using the existing flat checklist representation.

New properties automatically receive the 38-task Regular and 109-task Deep standards. Adopted standards are recognised by their saved task definitions, independently of applicability, and no longer show an adoption action. Existing property lists and checked progress are not overwritten. Hosts can explicitly choose **Use standard template**, which replaces that property's selected list and maps applicability/ticks by matching task text (unmatched exclusions block adoption for review); started job snapshots and job progress remain unchanged; untouched scheduled jobs refresh atomically. Marking equipment-specific tasks not applicable excludes them from future persisted job instances. Untouched scheduled jobs can now refresh to the current applicable list; started or uncertain snapshots are protected. Properties with no applicable tasks need Host setup before new completable jobs can be created; empty job snapshots cannot be submitted as completed.

## Cleaner-reported issues

Assigned Cleaners can record damage, maintenance, supplies, access or other issues while the job is scheduled. Each immutable issue has a description of 1–2,000 characters and optionally one photo. There is a server-side cap of 20 issues per job. Revision checks and the job row lock serialize reports with completion and assignment changes. A client retry UUID prevents duplicate inserts but never grants authority.

Every write/read rechecks the real assignment, current property membership and eligible job state. Hosts read issues only in their authorized workspace. Another Cleaner does not inherit the previous Cleaner's issue text/photo. Revocation immediately denies Cleaner reads and uploads; Host history remains available. The existing inability-to-attend action remains separate.

Photos reuse completion validation: JPEG/PNG/WebP, input up to 3 MiB and 16 megapixels, decoded and normalized to metadata-free JPEG, maximum 1,600 pixels and 2 MiB stored. Bytes live privately in Neon with the issue record. Authenticated, scoped no-store responses serve them; there are no public URLs, upload tokens or caller-provided storage references. Issue photos do not satisfy the separate 3–6 completion-photo requirement. No contact fields, feed URLs or Start Guide data are included in issue responses or event payloads.

## Future delivery foundation

`turnli_job_events` records job creation, relevant changes/cancellation, issue reporting, submission and Host review outcomes in the same transaction as the domain write. It stores IDs, revision, scheduled date, state and time only—no report text, guide, contact, guest or photo content. Future upcoming-clean delivery can query scheduled jobs by date/time and active assignment. No notification scheduler, transport, recipient directory or external message delivery is implemented.

## Migration and focused verification

Apply after migrations 001–008 using the established environment/database workflow:

```sh
node --env-file=.env.local scripts/migrate-turnovers-issues.cjs
npm run test:integration -- tests/turnovers-issues.integration.test.cjs
node --test tests/checklist-recovery.test.cjs tests/job-issues.test.cjs
```

The migration reconciles eligible existing calendars/assignments once. Integration tests use temporary synthetic records and remove them in `finally`. Browser fixtures never send invitations or external notifications.

Migration 010 (`node --env-file=.env.local scripts/migrate-turnover-reservation-state.cjs`) adds private hashed pending-removal IDs to each calendar and corrects reconciliation to distinguish missing assignments from missing reservations. It does not backfill or blindly reactivate existing cancelled jobs. Normal reconciliation considers only automatically cancelled jobs whose reservations are present, excluding unconfirmed retained reservations. Explicit Host cancellations and completed history stay unchanged. A second persistently incomplete source response cannot be distinguished from genuine removal in a snapshot-only iCal protocol; the two-successful-refresh rule is the confirmation policy.

## Safe planned-checklist reconciliation

Migration 011 adds sticky checklist protection and `turnli_reconcile_job_checklists(workspace, property)`. Property task/adoption/applicability saves use it automatically. It locks the existing workspace and scheduled job rows, applies that property’s current applicable Regular/Deep tasks and changes only tasks, revision and update time when the snapshot differs. It creates no jobs and changes no reservation, assignment or completion state. Stale checklist writes fail the existing revision check.

Any progress, draft photo, issue, submission/review metadata, terminal state or reservation-attention flag excludes a job. Protection survives unchecking tasks or removing photos. Legacy revision gaps are treated as uncertain work and protected. The sole recognised administrative gap is the extra revision in the existing atomic revocation/cancellation operation, corroborated by its cancellation event and matching assignment-revocation timestamp. No checklist snapshots are bulk-refreshed by migration; existing eligible properties may be reconciled explicitly. Repeated reconciliation is a no-op.

```sh
node --env-file=.env.local scripts/migrate-planned-job-checklists.cjs
npm run test:integration -- tests/planned-checklists.integration.test.cjs
```
