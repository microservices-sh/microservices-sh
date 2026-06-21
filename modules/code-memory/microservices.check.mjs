export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS code_memory_sources",
    "Code Memory migration owns Trusted Sources."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS code_memory_capsules",
    "Code Memory migration owns Logic Capsules."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "searchLogicCapsules",
    "Code Memory service exposes retrieval for approved capsules."
  );
}
