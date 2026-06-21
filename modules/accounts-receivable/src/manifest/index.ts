export const manifest = {
  schemaVersion: "2026-06-13",
  id: "accounts-receivable",
  name: "Accounts Receivable",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped accounts receivable module for customer payments, invoice applications, open receivables, aging, and customer statements.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
