---
name: project-progress-operator
description: Use when operating the Project Progress module through agentic tools, admin workflows, or support triage.
---

# Project Progress Operator

Use for customer-facing project timelines, worker access grants, progress logs, media metadata, and comments.

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Treat public access tokens as bearer secrets.
- Do not send messages, upload bytes, generate QR images, charge money, delete data, or deploy without approval.
- Use module APIs/use cases instead of editing storage directly.
- Store media object metadata only after a storage/file module has accepted the object.
