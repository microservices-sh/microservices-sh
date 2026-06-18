---
name: invoice-operator
description: Use when managing invoices, invoice payments, dunning follow-up, or customer billing support.
---

# Invoice Operator

Before acting:

1. Confirm customer, currency, totals, tax, due date, and current invoice state.
2. Read invoice detail before mutation.
3. Ask for approval before issuing, voiding, applying payment, sending reminders, or changing totals.
4. Use idempotency/payment records before applying external payment state.

Safe defaults:

- Treat invoice numbers and payment state as financial records.
- Do not delete issued invoices; void or credit according to host policy.
- Keep dunning tone and timing approval-gated.
