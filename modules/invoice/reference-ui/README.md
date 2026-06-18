# Invoice Reference UI

Reference UI is optional host-app code. The module owns invoice numbering, lifecycle, line items, payment application, and dunning hooks.

Admin surface:
- List invoices, draft and issue invoices, inspect payment state, and void approved mistakes.
- Gate reads with `invoice.read`; gate issue/payment/void flows with `invoice.write` or `invoice.admin`.

Visitor surface:
- Show invoice detail and payment actions from secure invoice links or authenticated accounts.
- Use the visitor feature key `invoices`.

Agentic surface:
- Require approval before issuing, voiding, applying payments, sending reminders, or changing invoice totals.
