export const manifest = {
  schemaVersion: "2026-06-13",
  id: "webhook-delivery",
  name: "Webhook Delivery",
  version: "0.1.0",
  status: "available",
  class: "sink",
  summary: "Outbound mirror of the event bus: registers external endpoints, delivers HMAC-signed events, logs attempts.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
