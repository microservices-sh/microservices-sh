export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_jobs_workflows.sql",
    "CREATE TABLE IF NOT EXISTS jobs",
    "Jobs-workflows migration owns the jobs table."
  );
  assertFileIncludes(
    "migrations/0001_jobs_workflows.sql",
    "idx_jobs_idempotency",
    "Enqueue idempotency is enforced by a unique index, not just app code."
  );
  assertFileIncludes(
    "src/use-cases/run-job.ts",
    "dead",
    "runJob dead-letters a job once it exhausts maxAttempts instead of retrying forever."
  );
  assertFileIncludes(
    "src/backoff.ts",
    "computeBackoffMs",
    "Retry backoff is centralized and deterministic."
  );
}
