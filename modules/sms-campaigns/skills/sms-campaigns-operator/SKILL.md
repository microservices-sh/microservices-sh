---
name: sms-campaigns-operator
description: Use when operating SMS contacts, consent groups, templates, campaigns, dispatch, or delivery reports through agentic tools.
---

# SMS Campaigns Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Confirm consent and campaign audience before creating or dispatching a campaign.
- Do not send messages, import contacts, charge money, delete data, or deploy without approval.
- Keep raw provider credentials out of D1; use secret references in provider configs.
- Use delivery log vendor message ids for callback replay/idempotency.
- Use module APIs/use cases instead of editing storage directly.
