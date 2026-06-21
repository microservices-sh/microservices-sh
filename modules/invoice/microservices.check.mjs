export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_invoice.sql",
    "CREATE TABLE IF NOT EXISTS invoices",
    "Invoice migration owns the invoices table."
  );
  assertFileIncludes(
    "src/adapters/d1-number-allocator.ts",
    "RETURNING value",
    "Invoice numbers are allocated atomically (upsert + RETURNING), not MAX()+1."
  );
  assertFileIncludes(
    "src/use-cases/record-payment.ts",
    "idempotencyKey",
    "Payments are idempotent so a redelivered webhook is applied once."
  );
  assertFileIncludes(
    "src/use-cases/add-line-item.ts",
    "INVOICE_NOT_EDITABLE",
    "Issued invoices are immutable; only drafts can be edited."
  );
  assertFileIncludes(
    "migrations/0001_invoice.sql",
    "CREATE TABLE IF NOT EXISTS invoice_recurring_templates",
    "Invoice migration owns recurring invoice templates."
  );
  assertFileIncludes(
    "migrations/0001_invoice.sql",
    "idx_invoices_recurring_occurrence",
    "Recurring invoice generation is protected by a unique occurrence key."
  );
  assertFileIncludes(
    "src/use-cases/generate-due-recurring-invoices.ts",
    "findByRecurringOccurrence",
    "Recurring invoice generation recovers existing occurrences on retries."
  );
}
