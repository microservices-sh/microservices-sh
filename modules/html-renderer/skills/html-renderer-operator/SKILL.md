---
name: html-renderer-operator
description: Use when operating the Html Renderer module through agentic tools, admin workflows, or support triage.
---

# Html Renderer Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not send messages, charge money, delete data, or deploy without approval.
- Use module APIs/use cases instead of editing storage directly.
