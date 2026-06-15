export default function check({ assertFileIncludesAll, assertFileIncludes }) {
  assertFileIncludesAll(
    "migrations/0001_identity.sql",
    [
      "CREATE TABLE IF NOT EXISTS accounts",
      "CREATE TABLE IF NOT EXISTS login_codes",
      "CREATE TABLE IF NOT EXISTS sessions"
    ],
    "Identity migration owns its accounts, login_codes, and sessions tables."
  );
  assertFileIncludes(
    "src/crypto.ts",
    "constantTimeEqual",
    "Login code verification uses a timing-safe comparison."
  );
  assertFileIncludes(
    "src/bridge.ts",
    "@microservices-sh/auth",
    "Session-to-token bridge is wired through the auth module, not a local secret."
  );
  assertFileIncludes(
    "src/use-cases/verify-login-code.ts",
    "sha256Hex",
    "Login codes are compared as salted SHA-256 hashes, never stored plaintext."
  );
}
