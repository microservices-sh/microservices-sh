export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_gateway.sql",
    "CREATE TABLE IF NOT EXISTS api_keys",
    "Gateway module migration owns the api_keys table."
  );
  assertFileIncludes(
    "src/crypto.ts",
    "SHA-256",
    "Gateway stores only the SHA-256 hash of an API key, never the raw value."
  );
}
