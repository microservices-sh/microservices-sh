---
name: recurring-documents-operator
description: Use when operating the Recurring Documents module through agentic tools, admin workflows, or support triage.
---

# Recurring Documents Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not send messages, approve bills, create live invoices, charge money, delete data, or deploy without approval.
- Generation returns draft payloads and updates recurrence tracking; persist real invoices/bills through the owning module or app adapter.
- Confirm active/paused/completed/cancelled status before changing schedules.
- Use module APIs/use cases instead of editing storage directly.
