export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounts_payable_vendors",
    "Accounts Payable migration owns vendors."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS accounts_payable_bills",
    "Accounts Payable migration owns bills."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_payments_idempotency",
    "Bill payments are idempotent per tenant."
  );
  assertFileIncludes(
    "src/use-cases/record-bill-payment.ts",
    "OVERPAYMENT",
    "Bill payment application guards against overpayment."
  );
}
