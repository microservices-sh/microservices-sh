export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS storage_accounts",
    "Storage Entitlements module migration owns storage accounts."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS storage_share_links",
    "Storage Entitlements module migration owns share links."
  );
}
