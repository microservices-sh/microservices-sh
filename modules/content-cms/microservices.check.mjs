export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS cms_content_types",
    "Content CMS migration owns content type definitions."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS cms_content_entry_versions",
    "Content CMS migration owns version history."
  );
  assertFileIncludes(
    "src/adapters/d1.ts",
    "createD1ContentCmsStore",
    "Content CMS exposes a D1 store adapter."
  );
  assertFileIncludes(
    "src/adapters/memory.ts",
    "createContentCmsMemoryStore",
    "Content CMS exposes an in-memory store adapter."
  );
}
