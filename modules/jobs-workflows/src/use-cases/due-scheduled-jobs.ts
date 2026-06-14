import { nextScheduleTick } from "../backoff";
import { enqueueJob } from "./enqueue-job";
import type { JobStore, QueueProducer, ScheduleStore } from "../ports";

// Cron catch-up: enqueue one job per schedule whose nextRunAt has passed, then
// advance nextRunAt to the first tick after now. A missed window enqueues once,
// not once per miss — the cron-gap failure agents leave out. The per-tick
// idempotency key makes overlapping cron invocations safe.
export async function dueScheduledJobs(deps: {
  scheduleStore: ScheduleStore;
  jobStore: JobStore;
  queue?: QueueProducer;
  now?: () => number;
}) {
  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const due = await deps.scheduleStore.listDue(nowIso);

  const items: Array<{ scheduleId: string; jobId: string | null }> = [];
  for (const schedule of due) {
    const tickKey = `sch:${schedule.id}:${schedule.nextRunAt}`;
    const res = await enqueueJob(
      {
        type: schedule.type,
        payload: schedule.payload,
        maxAttempts: schedule.maxAttempts,
        idempotencyKey: tickKey
      },
      { jobStore: deps.jobStore, queue: deps.queue, now: deps.now }
    );

    const nextMs = nextScheduleTick(Date.parse(schedule.nextRunAt), schedule.intervalMs, nowMs);
    schedule.lastRunAt = nowIso;
    schedule.nextRunAt = new Date(nextMs).toISOString();
    schedule.updatedAt = nowIso;
    await deps.scheduleStore.upsert(schedule);

    items.push({ scheduleId: schedule.id, jobId: res.data?.id ?? null });
  }

  return { ok: true as const, status: 200 as const, data: { enqueued: items.length, items } };
}
