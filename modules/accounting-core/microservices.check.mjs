export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_accounts",
    "Accounting Core module migration owns chart of accounts."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_fiscal_periods",
    "Accounting Core module migration owns fiscal periods."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_journal_entries",
    "Accounting Core module migration owns journal entries."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounting_journal_lines",
    "Accounting Core module migration owns journal lines."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_accounting_journal_entries_posted_source_ref",
    "Accounting Core module enforces posted source reference idempotency."
  );
}
