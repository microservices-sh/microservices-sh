export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS ar_invoice_snapshots",
    "Accounts Receivable module migration owns invoice snapshots."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS ar_customer_payments",
    "Accounts Receivable module migration owns customer payments."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "unapplied_cents INTEGER NOT NULL DEFAULT 0",
    "Accounts Receivable module migration stores unapplied payment balances."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS ar_payment_applications",
    "Accounts Receivable module migration owns payment applications."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_ar_invoice_snapshots_tenant_open_due",
    "Accounts Receivable module indexes open receivables."
  );
  assertFileIncludes(
    "src/resources/index.ts",
    "ar_invoice_snapshots",
    "Accounts Receivable resource manifest includes invoice snapshots."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_ar_payments_tenant_idempotency",
    "Accounts Receivable module enforces payment idempotency."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "invoice_overapplied",
    "Payment applications guard against invoice over-application."
  );
}
