import { describe, it, expect } from "vitest";
import {
  enqueueJob,
  runJob,
  dueScheduledJobs,
  upsertSchedule,
  createMemoryJobStore,
  createMemoryJobRunStore,
  createMemoryScheduleStore,
  computeBackoffMs
} from "./index";
import type { JobHandler } from "./types";

// Deterministic clock helper.
const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

describe("jobs-workflows: enqueue idempotency", () => {
  it("returns the SAME job for a repeated idempotencyKey (deduped)", async () => {
    const jobStore = createMemoryJobStore();
    const deps = { jobStore, now: fixedNow(T0) };

    const first = await enqueueJob({ type: "email", payload: { to: "a@b.c" }, idempotencyKey: "k1" }, deps);
    expect(first.ok).toBe(true);
    expect(first.status).toBe(201);
    expect(first.data?.deduped).toBe(false);
    const firstId = first.data?.id;
    expect(firstId).toBeTruthy();

    const second = await enqueueJob({ type: "email", payload: { to: "a@b.c" }, idempotencyKey: "k1" }, deps);
    expect(second.ok).toBe(true);
    expect(second.status).toBe(200);
    expect(second.data?.deduped).toBe(true);
    expect(second.data?.id).toBe(firstId);
  });
});

describe("jobs-workflows: runJob retry + dead-letter", () => {
  it("retries with backoff then dead-letters at maxAttempts", async () => {
    const jobStore = createMemoryJobStore();
    const runStore = createMemoryJobRunStore();

    const enq = await enqueueJob(
      { type: "flaky", payload: {}, maxAttempts: 3 },
      { jobStore, now: fixedNow(T0) }
    );
    const jobId = enq.data!.id as string;

    const alwaysFails: JobHandler = async () => {
      throw new Error("boom");
    };

    // Attempt 1: fails -> pending with backoff for attempt 1.
    const r1 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0) });
    expect(r1.ok).toBe(true);
    expect(r1.data?.status).toBe("pending");
    expect(r1.data?.attempt).toBe(1);
    expect(r1.data?.retryInMs).toBe(computeBackoffMs(1));

    // Attempt 2: still fails -> pending again.
    const r2 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0 + 1) });
    expect(r2.data?.status).toBe("pending");
    expect(r2.data?.attempt).toBe(2);
    expect(r2.data?.retryInMs).toBe(computeBackoffMs(2));

    // Attempt 3 == maxAttempts: dead-lettered.
    const r3 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0 + 2) });
    expect(r3.ok).toBe(false);
    expect(r3.data?.status).toBe("dead");
    expect(r3.data?.attempt).toBe(3);
    expect(r3.error?.code).toBe("JOB_DEAD");

    const job = await jobStore.get(jobId);
    expect(job?.status).toBe("dead");

    // The run log records all three attempts.
    const runs = await runStore.listForJob(jobId);
    expect(runs.length).toBe(3);
    expect(runs.every((run) => run.status === "failed")).toBe(true);
  });

  it("skips re-running a succeeded job (at-least-once redelivery guard)", async () => {
    const jobStore = createMemoryJobStore();
    const runStore = createMemoryJobRunStore();

    const enq = await enqueueJob({ type: "once", payload: {} }, { jobStore, now: fixedNow(T0) });
    const jobId = enq.data!.id as string;

    let calls = 0;
    const ok: JobHandler = async () => {
      calls += 1;
    };

    const first = await runJob(jobId, ok, { jobStore, runStore, now: fixedNow(T0) });
    expect(first.data?.status).toBe("succeeded");
    expect(calls).toBe(1);

    const second = await runJob(jobId, ok, { jobStore, runStore, now: fixedNow(T0 + 5) });
    expect(second.ok).toBe(true);
    expect(second.data?.skipped).toBe(true);
    expect(calls).toBe(1); // handler not invoked again
  });
});

describe("jobs-workflows: scheduled catch-up", () => {
  it("enqueues once for a missed window and advances nextRunAt past now", async () => {
    const scheduleStore = createMemoryScheduleStore();
    const jobStore = createMemoryJobStore();

    // Create a schedule whose first run is at T0, interval 1 minute.
    const intervalMs = 60_000;
    const created = await upsertSchedule(
      {
        type: "cron-task",
        payload: { foo: 1 },
        intervalMs,
        firstRunAt: new Date(T0).toISOString()
      },
      { scheduleStore, now: fixedNow(T0 - intervalMs) }
    );
    expect(created.ok).toBe(true);
    const scheduleId = created.data!.id;

    // "now" is 3.5 intervals after the first run: several windows were missed.
    const now = T0 + Math.floor(3.5 * intervalMs);
    const res = await dueScheduledJobs({ scheduleStore, jobStore, now: fixedNow(now) });
    expect(res.ok).toBe(true);
    expect(res.data?.enqueued).toBe(1); // exactly one enqueue, not one per missed window
    const jobId = res.data!.items[0].jobId;
    expect(jobId).toBeTruthy();

    // nextRunAt advanced strictly into the future.
    const sched = await scheduleStore.get(scheduleId);
    expect(Date.parse(sched!.nextRunAt)).toBeGreaterThan(now);

    // Re-running the catch-up at the same now is a no-op (schedule no longer due).
    const again = await dueScheduledJobs({ scheduleStore, jobStore, now: fixedNow(now) });
    expect(again.data?.enqueued).toBe(0);
  });
});
