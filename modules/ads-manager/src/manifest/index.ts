export const manifest = {
  schemaVersion: "2026-06-13",
  id: "ads-manager",
  name: "Ads Manager",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary:
    "Cross-platform ad monitoring (Meta, Google) over an upstream ads service. Records insight snapshots to D1, raises anomaly alerts, exposes a normalized campaign view. Entitlement-gated paid connector.",
  entrypoint: "src/index.ts",
} as const;

export const moduleDefinition = manifest;
