export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS sales_orders",
    "Sales Order module migration owns sales orders."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS sales_order_line_items",
    "Sales Order module migration owns sales order line items."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_tenant_external",
    "Sales Order module enforces tenant-scoped external references."
  );
}
