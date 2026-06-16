export const idempotencyPermissions = [
  "idempotency.claim",
  "idempotency.read",
  "idempotency.admin",
  "idempotency.extend",
  "idempotency.observe"
] as const;

export const permissions = idempotencyPermissions;
