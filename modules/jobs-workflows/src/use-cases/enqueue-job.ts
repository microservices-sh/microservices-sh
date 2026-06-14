import { beforeJobEnqueue } from "../hooks";
import { enqueueJobInputSchema } from "../schemas";
import type { JobStore, QueueProducer } from "../ports";
import type { Job } from "../types";

// Add a job to the queue. Idempotent when an idempotencyKey is supplied: a repeat
// enqueue returns the existing job instead of creating a duplicate — the guard
// agents routinely omit, which is how at-least-once delivery double-charges.
export async function enqueueJob(
  input: unknown,
  deps: { jobStore: JobStore; queue?: QueueProducer; now?: () => number }
) {
  const parsed = enqueueJobInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_JOB_INPUT", message: "Job input is invalid.", issues: parsed.error.issues }
    };
  }

  const hooked = await beforeJobEnqueue(parsed.data);
  if (!hooked) {
    return { ok: true as const, status: 200 as const, data: { id: null, deduped: false, skipped: true } };
  }

  const nowMs = deps.now?.() ?? Date.now();

  if (hooked.idempotencyKey) {
    const existing = await deps.jobStore.findByIdempotencyKey(hooked.idempotencyKey);
    if (existing) {
      return { ok: true as const, status: 200 as const, data: { id: existing.id, deduped: true, status: existing.status } };
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
  } catch (err) {
    // Lost a unique-constraint race on idempotency_key: another caller inserted
    // first. Return their job rather than surfacing the conflict.
    if (hooked.idempotencyKey) {
      const existing = await deps.jobStore.findByIdempotencyKey(hooked.idempotencyKey);
      if (existing) {
        return { ok: true as const, status: 200 as const, data: { id: existing.id, deduped: true, status: existing.status } };
      }
    }
    throw err;
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

  return { ok: true as const, status: 201 as const, data: { id: job.id, deduped: false, status: job.status } };
}
