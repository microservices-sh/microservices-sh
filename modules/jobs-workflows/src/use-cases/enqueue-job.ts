import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeJobEnqueue } from "../hooks";
import { enqueueJobInputSchema } from "../schemas";
import { jobsWorkflowsMeta } from "../meta";
import type { JobStore, QueueProducer } from "../ports";
import type { DomainEvent, Job } from "../types";

// Add a job to the queue. Idempotent when an idempotencyKey is supplied: a repeat
// enqueue returns the existing job instead of creating a duplicate — the guard
// agents routinely omit, which is how at-least-once delivery double-charges.
//
// Two customization layers run before insert (Plan 25 §5):
//   1. the local config seam `beforeJobEnqueue` (per-app override)
//   2. the cross-module `beforeJobEnqueue` hook chain, injected by the composed
//      app via deps.beforeEnqueueHooks — filters may mutate, guards may veto.
export async function enqueueJob(
  input: unknown,
  deps: {
    jobStore: JobStore;
    queue?: QueueProducer;
    now?: () => number;
    correlationId?: string;
    beforeEnqueueHooks?: ResolvedHook[];
  }
) {
  const meta = jobsWorkflowsMeta(deps);

  const parsed = enqueueJobInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_JOB_INPUT", message: "Job input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const configData = await beforeJobEnqueue(parsed.data);
  if (!configData) {
    // Local config seam dropped the job: silent skip, no row, no event.
    return ok(200, { id: null, deduped: false, skipped: true }, meta);
  }

  const gated = await runHooks(
    "beforeJobEnqueue",
    configData,
    { correlationId: meta.correlationId },
    deps.beforeEnqueueHooks ?? []
  );
  if (!gated.ok) {
    return err(gated.status, gated.error, meta);
  }
  const hooked = gated.value as typeof configData;

  const nowMs = deps.now?.() ?? Date.now();

  if (hooked.idempotencyKey) {
    const existing = await deps.jobStore.findByIdempotencyKey(hooked.idempotencyKey);
    if (existing) {
      return ok(200, { id: existing.id, deduped: true, status: existing.status }, meta);
    }
  }

  const job: Job = {
    id: "job_" + crypto.randomUUID().slice(0, 16),
    type: hooked.type,
    payload: hooked.payload,
    status: "pending",
    idempotencyKey: hooked.idempotencyKey ?? null,
    attempts: 0,
    maxAttempts: hooked.maxAttempts,
    runAt: new Date(nowMs + hooked.delayMs).toISOString(),
    lastError: null,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString()
  };

  try {
    await deps.jobStore.insert(job);
  } catch (e) {
    // Lost a unique-constraint race on idempotency_key: another caller inserted
    // first. Return their job rather than surfacing the conflict.
    if (hooked.idempotencyKey) {
      const existing = await deps.jobStore.findByIdempotencyKey(hooked.idempotencyKey);
      if (existing) {
        return ok(200, { id: existing.id, deduped: true, status: existing.status }, meta);
      }
    }
    throw e;
  }

  if (deps.queue) {
    // The queue is only a wake-up hint; D1 stays the source of truth, so a queue
    // failure must not fail the enqueue.
    try {
      await deps.queue.send(job.id);
    } catch {
      /* ignore: the pull loop will still pick the job up by runAt */
    }
  }

  const event: DomainEvent = {
    name: "job.enqueued",
    correlationId: meta.correlationId,
    payload: { id: job.id, type: job.type, runAt: job.runAt }
  };

  return ok(201, { id: job.id, deduped: false, status: job.status, event }, meta);
}
