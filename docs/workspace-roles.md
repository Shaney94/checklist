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

- Cleaner: `/app`, retaining all existing calendar, setup and checklist tools.
- Host: `/app/host`, with Properties, Reservations, Cleaning jobs, Cleaning
  setup and Account & settings destinations. These are explicit placeholders;
  no new domain operations or records are created. Account uses the existing
  shared controls.
- `/app` sends explicitly assigned hosts to `/app/host`. Cleaner requests for
  Host routes return 403; unsupported routes return 404. Authentication outages
  remain 503 and anonymous requests use the existing login.
- Both roles may read/manage their workspace's existing property setup and
  calendars and save their own sidebar preference. Only Cleaner may update
  checklist completion/reset or original-workspace progress. These existing
  Cleaner setup permissions are intentionally preserved.

## Data boundaries

The authenticated server identity supplies `workspaceId`; callers cannot select
another workspace. The existing membership model grants access to the properties
within that workspace. Property mutations require an ID in that workspace's
Neon document. Calendar reads/updates/deletes, feed URL exports, sync requests and
seen-booking writes use workspace-scoped records. Original encrypted content
requires both the original-workspace entitlement and Cleaner permission.

There is no new property-assignment model or membership/role editor in this
foundation. Per-cleaner assignments, multi-workspace switching and multiple
simultaneous roles require separate design before introducing narrower grants.
No database migration is needed, and no provider assignments are changed by
this code. Configure Host roles through the existing identity-provider admin
controls when ready.
