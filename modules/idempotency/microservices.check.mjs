export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS idempotency_records",
    "Idempotency module migration owns its primary table."
  );
}
