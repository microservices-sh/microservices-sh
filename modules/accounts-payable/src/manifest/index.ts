export const manifest = {
  schemaVersion: "2026-06-13",
  id: "accounts-payable",
  name: "Accounts Payable",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped accounts payable with vendors, bills, payable lifecycle, idempotent payment application, aging, recurring bill templates, and accounting-core handoff ports.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
