// Support-ticket lifecycle events. status_changed is emitted in addition to the
// generic updated event whenever an update transitions the ticket status, so
// consumers (notifications, SLA timers) can subscribe narrowly.
export const events = {
  emitted: ["support-ticket.created", "support-ticket.updated", "support-ticket.status_changed"],
  consumed: []
} as const;
