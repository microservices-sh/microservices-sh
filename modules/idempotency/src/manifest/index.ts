export const manifest = {
  schemaVersion: "2026-06-13",
  id: "idempotency",
  name: "Idempotency",
  version: "0.1.0",
  status: "available",
  class: "core",
  summary:
    "Reusable idempotency records for safely deduplicating retries, webhooks, jobs, payments, forms, and other at-least-once operations.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
