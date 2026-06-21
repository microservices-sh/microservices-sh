export const bankReconciliationEvents = {
  emitted: [
    "bank-reconciliation.bank_account_created",
    "bank-reconciliation.statement_imported",
    "bank-reconciliation.match_created",
    "bank-reconciliation.reconciliation_started",
    "bank-reconciliation.reconciliation_completed"
  ],
  consumed: ["accounting-core.journal_entry_posted", "payment.succeeded", "payment.refunded"]
} as const;
