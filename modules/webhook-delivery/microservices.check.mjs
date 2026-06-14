export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_webhook_delivery.sql",
    "CREATE TABLE IF NOT EXISTS webhook_endpoints",
    "Webhook-delivery migration owns the webhook_endpoints table."
  );
  assertFileIncludes(
    "src/signing.ts",
    "HMAC",
    "Webhook-delivery signs outbound payloads with HMAC-SHA256."
  );
}
