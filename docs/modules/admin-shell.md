# Admin Shell

Status: available
Module ID: `admin-shell`
Mount: `/admin`

## Summary
Schema-driven admin CRUD over host-owned D1 tables. Hosts declare a resource
registry; the module provides generic list/get/create/update/delete with RBAC,
soft-delete support, safe SQL identifiers, pagination, search, and audit hooks.

## Dependencies
- none

Optional integrations:

- auth
- audit-log

## Permissions
- admin.access
- admin.read
- admin.write
- admin-shell.extend

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- none

Admin Shell owns no tables. It operates over the host app's existing D1 tables
through a host-supplied table gateway and resource registry.

## Hooks
- beforeWrite
- onAdminAction

## Events
Emits:

- admin.record_created
- admin.record_updated
- admin.record_deleted

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- data mutations
- permission changes
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
