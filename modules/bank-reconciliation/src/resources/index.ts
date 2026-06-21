export const bankReconciliationResources = [
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
] as const;
