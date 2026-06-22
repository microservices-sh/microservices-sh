export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS inventory_stock_movements",
    "Inventory module migration owns stock movement rows."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_source_ref",
    "Inventory movement source references are idempotent per tenant, product, location, and movement type."
  );
  assertFileIncludes(
    "migrations/0002_reconciliation_documents.sql",
    "CREATE TABLE IF NOT EXISTS inventory_reconciliation_documents",
    "Inventory module migration owns reconciliation document headers."
  );
  assertFileIncludes(
    "migrations/0002_reconciliation_documents.sql",
    "CREATE TABLE IF NOT EXISTS inventory_reconciliation_lines",
    "Inventory module migration owns reconciliation document lines."
  );
  assertFileIncludes(
    "src/use-cases/complete-reconciliation-document.ts",
    "sourceType: \"reconciliation-document-line\"",
    "Reconciliation document completion creates idempotent line-scoped adjustment movements."
  );
}
