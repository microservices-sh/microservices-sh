// Outbound mirror sink: emits its own delivery lifecycle events and consumes the
// core domain events it fans out to external endpoints. Sources are optional in
// the manifest, so a missing source warns (not errors) at compose time.
export const events = {
  emitted: ["webhook.delivered", "webhook.failed"],
  consumed: [
    "auth.token_minted",
    "auth.key_rotated",
    "customer.created",
    "customer.updated",
    "booking.created",
    "booking.confirmed",
    "booking.cancelled",
    "payment.checkout_created",
    "payment.succeeded",
    "payment.refunded",
    "payment.failed"
  ]
} as const;
