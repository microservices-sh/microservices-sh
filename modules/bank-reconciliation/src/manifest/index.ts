export const manifest = {
  schemaVersion: "2026-06-13",
  id: "bank-reconciliation",
  name: "Bank Reconciliation",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped bank accounts, statement imports, matching corrections, exclusions, and reconciliation completion with integer-cent balances.",
  entrypoint: "src/index.ts",
  resources: [
    {
      type: "d1",
      binding: "DB",
      tables: [
        "bank_reconciliation_accounts",
        "bank_reconciliation_imports",
        "bank_reconciliation_transactions",
        "bank_reconciliation_matches",
        "bank_reconciliation_sessions",
        "domain_events"
      ]
    }
  ],
  events: [
    "bank-reconciliation.bank_account_created",
    "bank-reconciliation.statement_imported",
    "bank-reconciliation.match_created",
    "bank-reconciliation.transaction_unmatched",
    "bank-reconciliation.transaction_excluded",
    "bank-reconciliation.transaction_restored",
    "bank-reconciliation.reconciliation_started",
    "bank-reconciliation.reconciliation_completed"
  ]
} as const;

export const moduleDefinition = manifest;
