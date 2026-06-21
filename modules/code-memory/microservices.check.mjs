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
  assertFileIncludes(
    "src/scanner/index.ts",
    "suggestLogicCapsulesFromFiles",
    "Code Memory exposes metadata-only scanner suggestions."
  );
  assertFileIncludes(
    "README.agent.md",
    "Do not execute source repository code during scan.",
    "Code Memory agent guide preserves scan safety boundary."
  );
}
