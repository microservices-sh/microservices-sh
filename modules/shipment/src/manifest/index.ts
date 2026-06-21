export const manifest = {
  schemaVersion: "2026-06-13",
  id: "shipment",
  name: "Shipment",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary: "Shipment batches and fulfillment workflow with idempotent completion and shipment events.",
  entrypoint: "src/index.ts",
  resources: [
    { type: "d1", binding: "DB", tables: ["shipment_batches", "shipment_items", "domain_events"] }
  ],
  events: ["shipment.created", "shipment.completed", "shipment.cancelled"]
} as const;

export const moduleDefinition = manifest;
