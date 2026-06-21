---
name: membership-credits-operator
description: Use when operating membership tiers, customer memberships, customer credit balances, credit ledgers, or membership history.
---

# Membership Credits Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not change credit balances, change membership tiers, charge money, delete data, or deploy without approval.
- Use integer cents and service APIs only; never edit balance rows directly.
- Use module APIs/use cases instead of editing storage directly.
