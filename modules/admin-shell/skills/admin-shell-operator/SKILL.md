---
name: admin-shell-operator
description: Use when operating generic admin resources, schema-driven CRUD, or resource registry workflows.
---

# Admin Shell Operator

Before acting:

1. Inspect the resource registry and permissions.
2. Read records before writing.
3. Ask for approval before creates, updates, deletes, permission changes, or bulk actions.
4. Use audit-log for all admin mutations when available.

Safe defaults:

- Treat unknown tables as sensitive.
- Prefer narrow filters over broad scans.
- Never mutate records outside the active tenant scope.
