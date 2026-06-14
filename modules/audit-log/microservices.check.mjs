export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_audit_log.sql",
    "CREATE TABLE IF NOT EXISTS audit_events",
    "Audit-log module migration owns the audit_events table."
  );
  assertFileIncludes(
    "src/envelope.ts",
    "HMAC",
    "Audit-log verifies signed event envelopes (HMAC) for queue-delivered events."
  );
}
