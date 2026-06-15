import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { computeBackoffMs, onJobDead } from "../hooks";
import { jobsWorkflowsMeta } from "../meta";
import type { JobRunStore, JobStore } from "../ports";
import type { DomainEvent, Job, JobHandler, JobRun } from "../types";

// Execute one job exactly once per success. Handles the three things agents get
// wrong: idempotent re-runs (finished jobs are skipped, not re-executed under
// at-least-once redelivery), bounded backoff retries, and dead-lettering instead
// of infinite retry storms. correlationId threads from the caller (the pull loop
// passes the job's own id-derived trace) into meta and every emitted event.
export async function runJob(
  jobId: string,
  handler: JobHandler,
  deps: {
    jobStore: JobStore;
    runStore: JobRunStore;
    now?: () => number;
    correlationId?: string;
    onJobDeadHooks?: ResolvedHook[];
  }
) {
  const meta = jobsWorkflowsMeta(deps);

  const job = await deps.jobStore.get(jobId);
  if (!job) {
    return err(404, { code: "jobs-workflows.JOB_NOT_FOUND", message: `No job ${jobId}.` }, meta);
  }

  // At-least-once guard: never re-run a terminal job.
  if (job.status === "succeeded" || job.status === "dead") {
    return ok(200, { id: job.id, status: job.status, skipped: true }, meta);
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
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
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
    const event: DomainEvent = {
      name: "job.succeeded",
      correlationId: meta.correlationId,
      payload: { id: job.id, type: job.type, attempt }
    };
    return ok(200, { id: job.id, status: "succeeded" as const, attempt, event }, meta);
  }

  job.lastError = error;

  if (attempt >= job.maxAttempts) {
    job.status = "dead";
    job.updatedAt = finishedAt;
    await deps.jobStore.update(job);
    // Local config seam first, then the cross-module observer chain (Plan 25 §5):
    // operators page / fan out a dead-letter notification. Observers never veto.
    await onJobDead(job);
    await runHooks("onJobDead", job, { correlationId: meta.correlationId }, deps.onJobDeadHooks ?? []);
    const event: DomainEvent = {
      name: "job.dead",
      correlationId: meta.correlationId,
      payload: { id: job.id, type: job.type, attempt, lastError: error }
    };
    return err(
      200,
      { code: "jobs-workflows.JOB_DEAD", message: error },
      meta
    );
  }

  const retryInMs = computeBackoffMs(attempt);
  job.status = "pending";
  job.runAt = new Date(finishedMs + retryInMs).toISOString();
  job.updatedAt = finishedAt;
  await deps.jobStore.update(job);
  const event: DomainEvent = {
    name: "job.retried",
    correlationId: meta.correlationId,
    payload: { id: job.id, type: job.type, attempt, retryInMs }
  };
  return ok(200, { id: job.id, status: "pending" as const, attempt, retryInMs, lastError: error, event }, meta);
}
