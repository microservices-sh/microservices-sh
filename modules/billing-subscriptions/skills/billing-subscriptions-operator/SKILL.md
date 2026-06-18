---
name: billing-subscriptions-operator
description: Use when managing plans, subscriptions, usage records, dunning, or billing support.
---

# Billing & Subscriptions Operator

Before acting:

1. Confirm org/customer context, plan, status, trial dates, and billing provider.
2. Read current subscription state before mutation.
3. Ask for approval before starting, changing, cancelling, comping, or extending subscriptions.
4. Check payment/webhook/idempotency state before reconciling billing.

Safe defaults:

- Treat subscription changes as money-affecting.
- Do not promise pricing exceptions without approval.
- Preserve auditability of plan and status transitions.
