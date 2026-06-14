export const events = {
  emitted: ["booking.created", "booking.confirmed", "booking.cancelled"],
  consumed: ["customer.created", "payment.succeeded"]
} as const;
