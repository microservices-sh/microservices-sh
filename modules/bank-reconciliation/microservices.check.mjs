export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS bank_reconciliation_accounts",
    "Bank Reconciliation migration owns bank accounts."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS bank_reconciliation_imports",
    "Bank Reconciliation migration owns statement imports."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS bank_reconciliation_transactions",
    "Bank Reconciliation migration owns statement transactions."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_bank_reconciliation_transactions_hash",
    "Bank Reconciliation enforces transaction hash idempotency."
  );
  assertFileIncludes(
    "migrations/0002_transaction_cleared_state.sql",
    "cleared_reconciliation_id",
    "Bank Reconciliation migration owns provisional transaction clearing state."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "unmatched_transactions",
    "Bank Reconciliation blocks completion while unmatched transactions remain."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "suggestMatches",
    "Bank Reconciliation implements advertised match suggestions."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "createMatch",
    "Bank Reconciliation implements advertised explicit match creation."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "previewStatementImportCsv",
    "Bank Reconciliation implements advertised CSV import preview."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "clearReconciliationTransaction",
    "Bank Reconciliation implements advertised provisional transaction clearing."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "unclearReconciliationTransaction",
    "Bank Reconciliation implements advertised provisional transaction unclearing."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "clearedReconciliationId === reconciliation.id",
    "Bank Reconciliation finalizes only transactions cleared for the active session."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "buildStatementCsvPreview",
    "Bank Reconciliation keeps preview construction separate from persisted import writes."
  );
  assertFileIncludes(
    "src/types.ts",
    "BankStatementImportPreview",
    "Bank Reconciliation exposes a typed statement import preview result."
  );
  assertFileIncludes(
    "src/hooks.ts",
    "beforeMatchCreate",
    "Bank Reconciliation hook names align with the module contract."
  );
}
