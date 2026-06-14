import { computeBackoffMs, onJobDead } from "../hooks";
import type { JobRunStore, JobStore } from "../ports";
import type { Job, JobHandler, JobRun } from "../types";

// Execute one job exactly once per success. Handles the three things agents get
// wrong: idempotent re-runs (finished jobs are skipped, not re-executed under
// at-least-once redelivery), bounded backoff retries, and dead-lettering instead
// of infinite retry storms.
export async function runJob(
  jobId: string,
  handler: JobHandler,
  deps: { jobStore: JobStore; runStore: JobRunStore; now?: () => number }
) {
  const job = await deps.jobStore.get(jobId);
  if (!job) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "JOB_NOT_FOUND", message: `No job ${jobId}.` } };
  }

  // At-least-once guard: never re-run a terminal job.
  if (job.status === "succeeded" || job.status === "dead") {
    return { ok: true as const, status: 200 as const, data: { id: job.id, status: job.status, skipped: true } };
  }

  const startedMs = deps.now?.() ?? Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const attempt = job.attempts + 1;

  // Claim before work: count the attempt and mark running so a concurrent worker
  // does not also pick it up.
  job.status = "running";
  job.attempts = attempt;
  job.updatedAt = startedAt;
  await deps.jobStore.update(job);

  let error: string | null = null;
  try {
    const result = await handler(job.payload, job);
    if (result && result.ok === false) error = result.error ?? "Handler reported failure.";
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const finishedMs = deps.now?.() ?? Date.now();
  const finishedAt = new Date(finishedMs).toISOString();

  const run: JobRun = {
    id: "run_" + crypto.randomUUID().slice(0, 16),
    jobId: job.id,
    attempt,
    status: error ? "failed" : "succeeded",
    error,
    startedAt,
    finishedAt
  };
  await deps.runStore.append(run);

  if (!error) {
    job.status = "succeeded";
    job.lastError = null;
    job.updatedAt = finishedAt;
    await deps.jobStore.update(job);
    return { ok: true as const, status: 200 as const, data: { id: job.id, status: "succeeded" as const, attempt } };
  }

  job.lastError = error;

  if (attempt >= job.maxAttempts) {
    job.status = "dead";
    job.updatedAt = finishedAt;
    await deps.jobStore.update(job);
    await onJobDead(job);
    return {
      ok: false as const,
      status: 200 as const,
      data: { id: job.id, status: "dead" as const, attempt },
      error: { code: "JOB_DEAD", message: error }
    };
  }

  const retryInMs = computeBackoffMs(attempt);
  job.status = "pending";
  job.runAt = new Date(finishedMs + retryInMs).toISOString();
  job.updatedAt = finishedAt;
  await deps.jobStore.update(job);
  return {
    ok: true as const,
    status: 200 as const,
    data: { id: job.id, status: "pending" as const, attempt, retryInMs, lastError: error }
  };
}
