export default function check({ assertFileExcludes, assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS email_deliveries",
    "Email module migration owns delivery attempts."
  );
  assertFileIncludes(
    "src/adapters/resend-email-provider.ts",
    "https://api.resend.com",
    "Resend adapter uses the documented API base URL."
  );
  assertFileIncludes(
    "src/adapters/resend-email-provider.ts",
    "Idempotency-Key",
    "Resend adapter forwards retry idempotency keys."
  );
  assertFileIncludes(
    "src/adapters/resend-email-provider.ts",
    "User-Agent",
    "Resend adapter sets the required User-Agent header for direct HTTP calls."
  );
  assertFileIncludes(
    "module.json",
    "RESEND_API_KEY",
    "Email module declares the runtime secret instead of hardcoding credentials."
  );
  assertFileExcludes(
    "src/adapters/resend-email-provider.ts",
    "from 'resend'",
    "Email module avoids Node-only SDK coupling in the Workers-compatible adapter."
  );
}
