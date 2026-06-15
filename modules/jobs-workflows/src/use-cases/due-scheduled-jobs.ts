import { ok } from "@microservices-sh/connection-contract";
import { nextScheduleTick } from "../backoff";
import { enqueueJob } from "./enqueue-job";
import { jobsWorkflowsMeta } from "../meta";
import type { JobStore, QueueProducer, ScheduleStore } from "../ports";
import type { DomainEvent } from "../types";

// Cron catch-up: enqueue one job per schedule whose nextRunAt has passed, then
// advance nextRunAt to the first tick after now. A missed window enqueues once,
// not once per miss — the cron-gap failure agents leave out. The per-tick
// idempotency key makes overlapping cron invocations safe. correlationId threads
// from the cron caller into the batch meta and each enqueue.
export async function dueScheduledJobs(deps: {
  scheduleStore: ScheduleStore;
  jobStore: JobStore;
  queue?: QueueProducer;
  now?: () => number;
  correlationId?: string;
}) {
  const meta = jobsWorkflowsMeta(deps);
  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const due = await deps.scheduleStore.listDue(nowIso);

  const items: Array<{ scheduleId: string; jobId: string | null; event?: DomainEvent }> = [];
  for (const schedule of due) {
    const tickKey = `sch:${schedule.id}:${schedule.nextRunAt}`;
    const res = await enqueueJob(
      {
        type: schedule.type,
        payload: schedule.payload,
        maxAttempts: schedule.maxAttempts,
        idempotencyKey: tickKey
      },
      { jobStore: deps.jobStore, queue: deps.queue, now: deps.now, correlationId: meta.correlationId }
    );

    const nextMs = nextScheduleTick(Date.parse(schedule.nextRunAt), schedule.intervalMs, nowMs);
    schedule.lastRunAt = nowIso;
    schedule.nextRunAt = new Date(nextMs).toISOString();
    schedule.updatedAt = nowIso;
    await deps.scheduleStore.upsert(schedule);

    const jobId = res.ok ? res.data.id : null;
    const event: DomainEvent = {
      name: "job.scheduled",
      correlationId: meta.correlationId,
      payload: { scheduleId: schedule.id, jobId, type: schedule.type }
    };
    items.push({ scheduleId: schedule.id, jobId, event });
  }

  return ok(200, { enqueued: items.length, items }, meta);
}
