export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS ar_customer_payments",
    "Accounts Receivable module migration owns customer payments."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS ar_payment_applications",
    "Accounts Receivable module migration owns payment applications."
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
