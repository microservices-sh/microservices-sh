// Provider module: emits subscription lifecycle events. Consumes normalized
// Stripe webhooks via applyStripeEvent (idempotent).
export const events = {
  emitted: ["subscription.started", "subscription.activated", "subscription.past_due", "subscription.canceled", "subscription.plan_changed"],
  consumed: []
} as const;
