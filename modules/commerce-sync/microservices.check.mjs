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
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS commerce_sync_envelopes",
    "Commerce Sync module persists normalized commerce envelopes."
  );
  assertFileIncludes(
    "module.json",
    "commerce-sync.connection_created",
    "Commerce Sync module advertises domain-specific connection events."
  );
  assertFileIncludes(
    "module.json",
    "commerce-sync.sync_completed",
    "Commerce Sync module advertises domain-specific sync completion events."
  );
  assertFileIncludes(
    "module.json",
    "beforeCommerceWebhookRecord",
    "Commerce Sync module advertises webhook-record hook points."
  );
  assertFileIncludes(
    "module.json",
    "\"risk\": \"high\"",
    "Commerce Sync approval risk matches provider credential and webhook operations."
  );
}
