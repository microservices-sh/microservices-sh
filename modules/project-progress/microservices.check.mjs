export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS project_progress_projects",
    "Project Progress migration owns projects."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS project_progress_logs",
    "Project Progress migration owns progress logs."
  );
  assertFileIncludes(
    "src/adapters/d1.ts",
    "createD1ProjectProgressStore",
    "Project Progress exposes a D1 store adapter."
  );
  assertFileIncludes(
    "src/adapters/memory.ts",
    "createProjectProgressMemoryStore",
    "Project Progress exposes an in-memory store adapter."
  );
}
