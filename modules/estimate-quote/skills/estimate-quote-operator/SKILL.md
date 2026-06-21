---
name: estimate-quote-operator
description: Use when operating the Estimate Quote module through agentic tools, admin workflows, or support triage.
---

# Estimate Quote Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not send messages, create invoices, charge money, delete data, or deploy without approval.
- Keep quote edits in `draft`; use lifecycle actions for sent, viewed, accepted, declined, expired, converted, and void states.
- Conversion records an invoice id supplied by another module or adapter; this module does not create the invoice itself.
- Use module APIs/use cases instead of editing storage directly.
