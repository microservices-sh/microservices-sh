export const manifest = {
  schemaVersion: "2026-06-13",
  id: "inventory",
  name: "Inventory",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation, and derived balances.",
  entrypoint: "src/index.ts",
  resources: [
    {
      type: "d1",
      binding: "DB",
      tables: ["inventory_stock_movements", "inventory_events"]
    }
  ],
  events: [
    "inventory.stock_received",
    "inventory.stock_reserved",
    "inventory.stock_released",
    "inventory.stock_deducted",
    "inventory.stock_reconciled"
  ]
} as const;

export const moduleDefinition = manifest;
