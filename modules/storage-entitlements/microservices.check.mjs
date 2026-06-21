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
  assertFileIncludes(
    "src/ports/index.ts",
    "reserveAccountBytes",
    "Storage Entitlements store exposes atomic quota reservation."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "reserveStorageBytes",
    "Storage Entitlements service exposes storage reservation."
  );
  assertFileIncludes(
    "src/ports/index.ts",
    "addQuotaBytes",
    "Storage Entitlements store can add quota without overwriting usage."
  );
}
