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
    "src/use-cases/get-vendor.ts",
    "accountsPayableStore.getVendor",
    "Vendor detail read use case is backed by the tenant-scoped store lookup."
  );
  assertFileIncludes(
    "src/use-cases/update-vendor.ts",
    "accountsPayableStore.updateVendor",
    "Vendor master update use case persists through the store boundary."
  );
  assertFileIncludes(
    "src/use-cases/update-vendor-status.ts",
    "accountsPayableStore.updateVendor",
    "Vendor active-state updates persist through the store boundary."
  );
  assertFileIncludes(
    "src/use-cases/get-1099-vendor-report.ts",
    "paymentDateBefore",
    "1099 vendor report uses date-bounded posted payments."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { getVendor }",
    "Accounts Payable exports vendor detail read use case."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { get1099VendorReport }",
    "Accounts Payable exports formal 1099 readiness report use case."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { listBillPayments }",
    "Accounts Payable exports bill payment read use cases."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { postBillToAccounting }",
    "Accounts Payable exports a separate accounting post use case for approved bills."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { voidBill }",
    "Accounts Payable exports a bill void and accounting reversal use case."
  );
  assertFileIncludes(
    "src/index.ts",
    "export { voidBillPayment }",
    "Accounts Payable exports a bill payment void and reversal use case."
  );
  assertFileIncludes(
    "src/use-cases/post-bill-to-accounting.ts",
    "BILL_NOT_APPROVED",
    "Bill posting is split from approval and rejects unapproved bills."
  );
  assertFileIncludes(
    "src/use-cases/void-bill.ts",
    "BILL_REQUIRES_ACCOUNTING_REVERSAL",
    "Posted bill voids require an accounting reversal hook before AP status is voided."
  );
  assertFileIncludes(
    "src/use-cases/void-bill.ts",
    "voidAccountsPayableBill",
    "Bill void delegates posted bill reversal through the accounting poster boundary."
  );
  assertFileIncludes(
    "src/use-cases/void-bill.ts",
    "BILL_HAS_PAYMENTS",
    "Bill void rejects bills with payment applications."
  );
  assertFileIncludes(
    "src/use-cases/void-bill-payment.ts",
    "BILL_PAYMENT_REQUIRES_ACCOUNTING_REVERSAL",
    "Payment void rejects accounting-posted payments unless an accounting reversal hook is supplied."
  );
  assertFileIncludes(
    "src/use-cases/void-bill-payment.ts",
    "voidPaymentWithBillUpdates",
    "Payment void persists payment status and restored bill balances through one store boundary."
  );
  assertFileIncludes(
    "src/events/index.ts",
    "accounts-payable.bill_payment_voided",
    "Accounts Payable declares bill payment void events."
  );
  assertFileIncludes(
    "src/use-cases/record-bill-payment.ts",
    "BILL_NOT_POSTED",
    "Accounting-backed bill payments require the bill to be posted before settlement."
  );
  assertFileIncludes(
    "src/ports/index.ts",
    "listPayments(filter: BillPaymentFilter)",
    "Accounts Payable store exposes tenant-scoped bill payment listing."
  );
  assertFileIncludes(
    "src/adapters/d1-accounts-payable-store.ts",
    "accounts_payable_bill_payment_applications a",
    "D1 bill payment listing supports bill-filtered payment history through applications."
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
