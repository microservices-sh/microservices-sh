export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS products",
    "Product Catalog module migration owns products."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS catalog_categories",
    "Product Catalog module migration owns catalog categories."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS combo_products",
    "Product Catalog module migration owns combo product composition."
  );
}
