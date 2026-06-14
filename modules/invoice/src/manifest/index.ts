export const manifest = {
  schemaVersion: "2026-06-13",
  id: "invoice",
  name: "Invoice",
  version: "0.1.0",
  status: "available",
  class: "core",
  summary: "Invoices with gapless atomic numbering, per-line tax, an enforced draft->open->paid->void lifecycle, idempotent payment application, and dunning hooks.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
