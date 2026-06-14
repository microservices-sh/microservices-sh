export const manifest = {
  schemaVersion: "2026-06-13",
  id: "audit-log",
  name: "Audit Log",
  version: "0.1.0",
  status: "available",
  class: "sink",
  summary: "Append-only audit trail. Pure event sink: records domain events from a signed queue or direct calls.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
