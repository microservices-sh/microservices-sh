# Payment Reference UI

Reference UI is optional host-app code. The module owns gateway interaction, payment records, and webhook verification.

Admin surface:
- List payments, inspect transaction state, and review webhook outcomes.
- Gate read views with `payment.read`; gate refunds or manual adjustments with `payment.admin`.

Visitor surface:
- Start checkout or payment-intent flows for invoices, bookings, events, memberships, or shop orders.
- Use the visitor feature key `payments`.

Agentic surface:
- Require approval before creating payment intents, refunds, retries, manual captures, or gateway configuration changes.
