export const manifest = {
  schemaVersion: "2026-06-13",
  id: "accounting-core",
  name: "Accounting Core",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, and trial balance.",
  entrypoint: "src/index.ts",
  resources: [
    {
      type: "d1",
      binding: "DB",
      tables: [
        "accounting_accounts",
        "accounting_fiscal_periods",
        "accounting_journal_entries",
        "accounting_journal_lines",
        "domain_events"
      ]
    }
  ],
  events: [
    "accounting-core.account_created",
    "accounting-core.fiscal_period_created",
    "accounting-core.fiscal_period_status_changed",
    "accounting-core.journal_entry_created",
    "accounting-core.journal_entry_updated",
    "accounting-core.journal_entry_posted",
    "accounting-core.journal_entry_voided"
  ]
} as const;

export const moduleDefinition = manifest;
