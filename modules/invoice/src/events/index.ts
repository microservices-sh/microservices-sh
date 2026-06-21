// Core record module: emits invoice lifecycle events. Overdue detection is driven
// by the host (e.g. a jobs-workflows schedule calling dueForReminder).
export const events = {
  emitted: [
    "invoice.created",
    "invoice.issued",
    "invoice.paid",
    "invoice.voided",
    "invoice.overdue",
    "invoice.payment_link_created",
    "invoice.recurring_template_created",
    "invoice.recurring_template_status_updated",
    "invoice.recurring_invoice_generated"
  ],
  consumed: []
} as const;
