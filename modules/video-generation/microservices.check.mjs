export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS video_generation_jobs",
    "Video Generation migration owns async generation jobs."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS video_generation_outputs",
    "Video Generation migration owns output records."
  );
  assertFileIncludes(
    "src/adapters/d1.ts",
    "createD1VideoGenerationStore",
    "Video Generation exposes a D1 store adapter."
  );
  assertFileIncludes(
    "src/adapters/memory.ts",
    "createVideoGenerationMemoryStore",
    "Video Generation exposes an in-memory store adapter."
  );
}
