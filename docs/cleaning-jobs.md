# Properties, cleaning jobs and assignments

Property-level email invitations now provide the default assignment path; see [property assignments](property-assignments.md) for acceptance, inherited jobs, operational calendars and revocation. The private job-code path below remains supported.

Properties remain in the existing workspace document (`turnli_dashboard`). Hosts create or rename them and edit their cleaning lists through the existing revision-checked API. Every property lookup and job creation is scoped to the authenticated Host's workspace. There is no second property model.

`turnli_cleaning_jobs` belongs to that workspace and a property in its document. Jobs are manually scheduled cleaning work, never reservations. Creating a job snapshots the selected regular/deep task list; later template changes affect future jobs. Checklist progress belongs to the job and persists in PostgreSQL, including through reassignment. Jobs can be assigned, reassigned, unassigned or cancelled. Cancellation is terminal in this first version. Dates do not assert physical checkout or automatically authorize completion.

An authenticated, verified Cleaner generates a random 256-bit assignment code. Only its SHA-256 hash is persisted in `turnli_cleaner_codes`, keyed by the identity provider's user ID. The raw code is shown once, never placed in a URL or browser storage. Rotation invalidates the previous code without changing existing assignments. A code only identifies an account for assignment; it never authenticates a caller. There is no public directory or identity search. The Host's own eligible job is checked before the code lookup. Assignment also verifies the Cleaner’s current enabled, verified, server-managed role through Descope and rechecks the code hash when writing.

A job has at most one assigned Cleaner. The assignment's stable user ID, eligible job state and current property ownership are checked server-side for every Cleaner read/write. Guide access and checklist changes require a scheduled job; submitted completion remains readable by its assigned Cleaner. Guide reads check these relationships in the same SQL statement that reads the separate guide table. Reassignment, unassignment or cancellation immediately revoke server access. No guide editing permission is granted. The UI clears/revalidates sensitive content on focus, visibility changes and periodically; already-seen information cannot be withdrawn from a person.

Cleaner job responses contain only assigned job metadata, its task snapshot/progress, the property's FAQs and, while scheduled, its configured Host contact number for the manual inability-to-attend flow. They exclude the workspace document, private notes, feed URLs, other Cleaners and other properties. Cleaners retain calendar administration for properties/customers in their own personal workspace, including existing unlinked feeds. Hosts administer their own workspace calendars. The central `managedWorkspace` policy separates personal Cleaner administration from shared Host tenant membership. Calendar links never grant assignment or guide access.

Migration 006 adds `turnli_calendars.property_id`. New calendar connections require an explicitly selected property, checked against the owning workspace before fetching the feed and again in the SQL write. Existing calendars keep their original owners and null property links. Users can explicitly link them to a property within the same workspace. No match is inferred from property names or feed contents. Shared legacy tenant calendars cannot be moved to a personal Cleaner workspace without confirming ownership.

Roles still come only from Descope's managed roles. Unassigned-role accounts remain Cleaners. An explicit Host role is required for administration. Changing a Cleaner to an unsupported or Host role removes Cleaner access at the next authenticated request. Assignment does not grant workspace membership or Host privileges.

## Migration and verification

Apply after migrations 001–004:

```sh
node --env-file=.env.local scripts/migrate-cleaning-jobs.cjs
node --env-file=.env.local scripts/migrate-calendar-properties.cjs
```

The scripts apply `005-cleaning-jobs.sql` and `006-calendar-properties.sql` atomically. Existing records and reservations are not transformed or assigned. Descope's configured management key needs permission to load a user by ID; provider failures fail closed.

The focused Neon integration test creates synthetic records and removes them in `finally`:

```sh
TURNLI_TEST_DATABASE=1 node --env-file=.env.local --test tests/cleaning-jobs.integration.test.cjs
```

Browser tests use synthetic API fixtures; they do not establish production identity-provider configuration. Completion photos and Host review extend these jobs as documented in [clean completion](clean-completion.md). Invitations, teams, notifications and payments remain outside this implementation.

Calendar ownership integration checks use synthetic records and a process-local test encryption key. Testing existing encrypted feeds locally requires the original `TURNLI_CONTENT_KEY`; never generate a replacement for existing data.
