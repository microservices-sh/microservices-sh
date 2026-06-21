---
name: support-inbox-operator
description: Use when operating support widget settings, quick actions, inbox conversations, messages, agent takeover, or channel metadata.
---

# Support Inbox Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not add agent messages, enable takeover, configure channels, send external provider messages, delete data, or deploy without approval.
- Keep raw provider tokens out of D1; use secret references.
- Route ticket escalation to `support-ticket`.
- Route grounded answer drafting to `knowledge-base-rag`.
- Use module APIs/use cases instead of editing storage directly.
