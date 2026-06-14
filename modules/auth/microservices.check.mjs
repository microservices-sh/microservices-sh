export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_auth.sql",
    "CREATE TABLE IF NOT EXISTS signing_keys",
    "Auth module migration owns the signing_keys table."
  );
  assertFileIncludes(
    "src/jwt.ts",
    "Ed25519",
    "Auth tokens are signed with EdDSA (Ed25519), not a shared HS256 secret."
  );
}
