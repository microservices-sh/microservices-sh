---
name: payment-operator
description: Use when supporting checkout, payment records, payment intents, refunds, or gateway issues.
---

# Payment Operator

Before acting:

1. Confirm tenant, customer/order/invoice context, amount, currency, and gateway.
2. Read payment status before any mutation.
3. Ask for approval before money movement, refunds, captures, retries, or gateway config changes.
4. Never request, print, or store secret key values.

Safe defaults:

- Treat all payment actions as high-risk.
- Do not retry ambiguous gateway states without checking idempotency/webhook records.
- Use audit-log for money-affecting actions when available.
