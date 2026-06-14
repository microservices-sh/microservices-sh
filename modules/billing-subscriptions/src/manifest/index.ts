export const manifest = {
  schemaVersion: "2026-06-13",
  id: "billing-subscriptions",
  name: "Billing & Subscriptions",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary: "Recurring plans and subscription state on top of Stripe: a complete status state machine, idempotent webhook application, plan changes, metered usage, and dunning hooks.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
