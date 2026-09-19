# Clean completion and Host review

This extends the existing `turnli_cleaning_jobs` rows, assignments and task snapshots. It does not interpret reservations as work or scheduled checkout as actual checkout.

## States

- `scheduled`: the assigned, authenticated Cleaner may check tasks and add/remove draft evidence. A job must contain tasks, all tasks must be checked, and 3–6 distinct valid photos are required to submit.
- `awaiting_review`: completed and submitted. Checklist and photos are locked. Host assignment changes and cancellation are also blocked.
- `approved`: the workspace Host approved the submission. Original evidence remains locked.
- `issue_reported`: the Host recorded a required issue description. Original evidence remains locked. This version does not reopen or overwrite it. A later corrective/re-clean submission must be a separate record linked to this original job/issue.
- `cancelled`: existing cancellation before submission remains available to Hosts.

Submission records the authenticated Cleaner and server timestamp. Review records the authenticated Host, server timestamp and issue text. Only one review transition from awaiting review is allowed. Revision checks reject stale requests. Job row locks serialize photo writes, checklist changes, submission, assignment and cancellation. Reassignment/unassignment/cancellation remove draft photos from a previous Cleaner without affecting submitted evidence. Existing job checklist progress survives reassignment.

A Cleaner may read only their assigned job's completion. A Host may read submitted completion only in their own workspace. Each query rechecks the property's membership of the job's workspace. Property/calendar ownership is never evidence of a cleaning-job assignment. Guide access remains limited to scheduled assigned jobs; completion history does not confer ongoing property-access permissions.

## Private uploads

No private object store is configured. For this bounded first version, `turnli_cleaning_job_photos` stores normalized JPEG bytes and metadata privately in Neon/PostgreSQL with a foreign key to the existing job. Workspace/property ownership is derived from that job, not duplicated or accepted from the client. The database also has an older `turnli_completion_photos` table referencing legacy `turnli_clean_jobs`; its records are not reused or rewritten.

The authenticated API accepts one photo per bounded request. Allowed input is JPEG, PNG or WebP, at most 3 MiB and 16 megapixels, single-frame only. Sharp fully decodes, applies orientation, downsizes to at most 1600×1600 and re-encodes JPEG without EXIF/GPS metadata. Stored images are at most 2 MiB. The database and locked writes enforce the six-photo cap, and normalized content hashes prevent exact duplicates. File names, claimed dimensions, storage keys and URLs supplied by clients do not determine storage or authorization.

Photos are served only by `/api/completion?jobId=…&photoId=…` after authentication and resource authorization. These are private, session-bound routes, not public or permanent bearer URLs. Responses use private/no-store, nosniff and fixed image content types. Images are not passed through a public image optimizer. Files and metadata never enter browser storage, feeds, notifications or application logs.

Storage is bounded to 12 MiB of normalized photos per job. Larger-scale retention/object storage is a future operational decision, not an additional provider dependency in this version. Neon’s configured database security protects the stored data; no browser storage or local filesystem persistence is used.

The existing manual “Can’t make this clean” calendar behaviour is retained. Assigned scheduled jobs offer the same user-initiated contact flow using the assigned property's existing Host number, where configured. It opens a message for the Cleaner to send manually; it neither sends a notification nor cancels the job. Without a number, the UI tells the Cleaner to contact the Host directly.

## Migration and checks

After migrations 001–006:

```sh
node --env-file=.env.local scripts/migrate-clean-completion.cjs
```

This applies `007-clean-completion.sql` atomically. No jobs are automatically completed or assigned.

```sh
node --test tests/completion.test.cjs tests/cleaning-jobs.test.cjs
TURNLI_TEST_DATABASE=1 node --env-file=.env.local --test tests/completion.integration.test.cjs tests/cleaning-jobs.integration.test.cjs
```

The opt-in database tests use synthetic data and remove it in `finally`. Browser tests use synthetic API fixtures; real HTTP role rejection is also checked. Corrective submissions, notifications, payments and quality scoring are not implemented.
