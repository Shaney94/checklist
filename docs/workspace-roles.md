# Workspace roles

Turnli keeps one Descope authentication flow and the existing Neon workspace,
property, calendar and checklist models. `lib/authorization.cjs` is the shared
role/permission and route policy. Domain handlers enforce it independently of
navigation, after authenticating every request.

## Assignment and compatibility

Accounts without an explicit Turnli role remain **cleaners**. To enable Host,
an administrator assigns `turnli-host` in Descope. `turnli-cleaner` explicitly
selects Cleaner. No signup parameter, URL, browser state, email/account type or
editable profile attribute grants a role.

Roles are read from the authenticated provider `/me` response, not decoded
client claims. For the existing shared workspace, only that tenant's
`roleNames` apply; for the existing personal workspace, project `roleNames`
apply. Membership selects the existing data scope, not a role. Roles from a
foreign tenant or project roles on a shared-workspace request cannot grant
Host access. Unrelated provider roles are ignored. Unknown `turnli-*` roles,
conflicting Turnli roles and malformed role lists are rejected. New supported
roles must be added explicitly to the central mapping and permission policy;
the no-role Cleaner fallback stays unchanged.

## Routes and permissions

- Cleaner: `/app`, with their own property calendars, assigned jobs, persistent job checklists, FAQs and read-only Start Guides. Private assignment codes identify authenticated Cleaners without granting authentication or property access.
- Host: `/app/host`, with property/task setup, existing reservation calendars, cleaning job creation/assignment, the Start Guide editor and shared account controls.
- `/app` sends explicit Hosts to `/app/host`. Cleaner requests for Host routes return 403; unsupported routes return 404. Authentication outages remain 503 and anonymous requests use the existing login.
- Hosts administer properties and calendars in their authenticated Host workspace. Cleaners administer properties and calendars in their personal Cleaner workspace. Host-owned operational data and Start Guides still require active job assignments. Both roles retain account preferences.

## Data boundaries

The authenticated Host identity supplies `workspaceId`; callers cannot select another workspace. Property mutations require an ID in that workspace's Neon document. Calendar reads/updates/deletes, feed URL exports, sync requests and seen-booking writes remain workspace-scoped.

Cleaner calendar/property administration uses `managedWorkspace(user)` from the central policy: `user:<authenticated ID>`. Host administration retains the existing authenticated `workspaceId`. Legacy tenant membership cannot expose another Host’s properties or feeds. Reads of Host-assigned work derive the property/workspace from the real job assignment, independently of the Cleaner’s own calendar records.

Migration 006 adds nullable property IDs to calendars. New feeds require explicit selection of a property in the managed workspace. Existing feeds stay unlinked until explicitly linked; existing owners are not changed. A link never establishes a job assignment or grants access to a Start Guide. Shared legacy tenant feeds are not copied or assigned to individuals without reliable ownership evidence.

See [Cleaning jobs](cleaning-jobs.md) for the assignment model, migration 005 and focused persistence/isolation checks. Role routing itself needs no migration and does not change provider role assignments. Invitations, multi-workspace switching and team management are not implemented.

## Property Start Guide

Only explicitly assigned Hosts have `guide.read` and `guide.write`. The dedicated
`/api/start-guide` handler checks the server-authenticated role and workspace,
then requires the property to exist in that workspace's stored document. It does
not accept a caller-supplied workspace, assignment or job as evidence of access.

Guides live in `turnli_property_guides`, separately from `turnli_dashboard` and
calendar snapshots. Apply `migrations/004-property-guides.sql` using
`node scripts/migrate-property-guides.cjs` with the existing server-side
`DATABASE_URL` configured, after the dashboard migration. Reads/writes use both
workspace and property IDs. Writes recheck property ownership and use revision
comparison to prevent lost updates. The API is private/no-store and returns
plain text fields only. Existing checklist, bootstrap and calendar responses do
not include guides. Guide content is never stored in browser storage.

Cleaner guide reads require `guide.assigned` and a real scheduled job assigned to the authenticated user. The server derives the property/workspace from the job and verifies the assignment and property ownership in the same SQL query that reads the guide. Cancellation, unassignment or reassignment revokes access. Cleaners cannot edit guides. Workspace membership, code possession and caller-supplied property IDs do not grant access.
