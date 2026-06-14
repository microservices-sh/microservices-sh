export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_customer.sql",
    "CREATE TABLE IF NOT EXISTS customers",
    "Customer module migration owns the customers table."
  );
}
