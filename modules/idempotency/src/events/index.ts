export const idempotencyEvents = {
  "emitted": [
    "idempotency.claimed",
    "idempotency.replayed",
    "idempotency.completed",
    "idempotency.failed",
    "idempotency.expired_pruned"
  ],
  "consumed": []
} as const;

export const events = idempotencyEvents;
