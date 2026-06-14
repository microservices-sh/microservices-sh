export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_payment.sql",
    "CREATE TABLE IF NOT EXISTS payments",
    "Payment module migration owns the payments table."
  );
  assertFileIncludes(
    "src/webhook.ts",
    "HMAC",
    "Payment verifies Stripe webhook signatures with HMAC-SHA256."
  );
}
