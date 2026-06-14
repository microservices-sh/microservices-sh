export const manifest = {
  schemaVersion: "2026-06-13",
  id: "payment",
  name: "Payment",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary: "Stripe-backed payment provider: create payment intents, record payments, and verify signed Stripe webhooks.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
