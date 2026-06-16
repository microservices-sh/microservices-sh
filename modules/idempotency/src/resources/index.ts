export const idempotencyResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "idempotency_records"
    ]
  }
] as const;

export const resources = idempotencyResources;
