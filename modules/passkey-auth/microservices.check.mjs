export default function check({ assertFileIncludesAll, assertFileIncludes }) {
  assertFileIncludesAll(
    "migrations/0001_passkey_auth.sql",
    [
      "CREATE TABLE IF NOT EXISTS passkey_credentials",
      "CREATE TABLE IF NOT EXISTS passkey_challenges"
    ],
    "Passkey-auth migration owns its passkey_credentials and passkey_challenges tables."
  );
  assertFileIncludes(
    "src/use-cases/verify-authentication.ts",
    "newCounter <= ",
    "verify-authentication enforces the WebAuthn signature counter (rejects counter regression / clone replay)."
  );
  assertFileIncludes(
    "src/use-cases/verify-authentication.ts",
    "return ok(200, { userId",
    "verify-authentication returns the verified userId; it does NOT mint a session (the host app does)."
  );
  assertFileIncludesAll(
    "src/index.ts",
    ["createMemoryPasskeyStore", "createD1PasskeyStore"],
    "Module exports both the memory and D1 PasskeyStore adapters against one port."
  );
}
