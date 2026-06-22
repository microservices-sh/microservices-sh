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
    "default_expense_account_id TEXT",
    "Accounts Payable vendors persist a default expense account reference."
  );
  assertFileIncludes(
    "src/use-cases/create-bill.ts",
    "vendor.defaultExpenseAccountId",
    "Bill creation falls back to a vendor default expense account when line accounts are blank."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { getBill }",
    "Accounts Payable exports a tenant-scoped bill detail read use case."
  );
  assertFileIncludes(
    "src/use-cases/get-bill.ts",
    "accountsPayableStore.getBill",
    "Bill detail read use case is backed by the tenant-scoped store lookup."
  );
  assertFileIncludes(
    "src/use-cases/create-recurring-bill-template.ts",
    "vendor.defaultExpenseAccountId",
    "Recurring bill templates fall back to a vendor default expense account when line accounts are blank."
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
