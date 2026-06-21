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
    "src/service/index.ts",
    "unmatched_transactions",
    "Bank Reconciliation blocks completion while unmatched transactions remain."
  );
}
