# Org, Team & RBAC

Status: available
Module ID: `org-team-rbac`
Mount: `/orgs`

## Summary
Multi-tenant organizations, memberships, roles, and invitations with permission
resolution, tenant isolation, single-use expiring invites, and last-owner
protection.

## Dependencies
- none

Optional integrations:

- auth
- audit-log

## Permissions
- org.read
- org.manage
- member.manage
- org-team-rbac.extend
- org-team-rbac.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- organizations
- memberships
- roles
- invitations

## Hooks
- beforeInvite
- onMembershipChanged

## Events
Emits:

- org.created
- org.updated
- member.invited
- member.joined
- member.removed
- role.updated

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- permission changes
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
