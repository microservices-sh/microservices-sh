---
name: org-team-rbac-operator
description: Use when managing organizations, team members, invitations, roles, authorization, or RBAC support.
---

# Org, Team & RBAC Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect organization, requester, target user, and current permissions before mutation.
3. Ask for approval before invites, role updates, member removal, role creation, or organization updates.
4. Record permission and membership changes through audit-log when available.

Safe defaults:

- Treat membership and role data as security-sensitive.
- Do not widen permissions unless the request is explicit and approved.
