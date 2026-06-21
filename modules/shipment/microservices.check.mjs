export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS shipment_batches",
    "Shipment module migration owns shipment batches."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS shipment_items",
    "Shipment module migration owns shipment items."
  );
}
