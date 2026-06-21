export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS commerce_sync_connections",
    "Commerce Sync module migration owns provider connections."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_commerce_sync_mapping_external",
    "Commerce Sync module enforces external mapping uniqueness."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "idx_commerce_sync_webhook_idempotency",
    "Commerce Sync module enforces webhook idempotency."
  );
}
