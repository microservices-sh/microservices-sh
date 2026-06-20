import { describe, it, expect } from "vitest";
import {
  enqueueJob,
  runJob,
  dueScheduledJobs,
  upsertSchedule,
  listSchedules,
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
    if (!first.ok) throw new Error("expected ok");
    expect(first.data.deduped).toBe(false);
    const firstId = first.data.id;
    expect(firstId).toBeTruthy();

    const second = await enqueueJob({ type: "email", payload: { to: "a@b.c" }, idempotencyKey: "k1" }, deps);
    expect(second.ok).toBe(true);
    expect(second.status).toBe(200);
    if (!second.ok) throw new Error("expected ok");
    expect(second.data.deduped).toBe(true);
    expect(second.data.id).toBe(firstId);
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
    if (!enq.ok) throw new Error("expected ok");
    const jobId = enq.data.id as string;

    const alwaysFails: JobHandler = async () => {
      throw new Error("boom");
    };

    // Attempt 1: fails -> pending with backoff for attempt 1.
    const r1 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0) });
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("expected ok");
    expect(r1.data.status).toBe("pending");
    if (r1.data.status === "pending") {
      expect(r1.data.attempt).toBe(1);
      expect(r1.data.retryInMs).toBe(computeBackoffMs(1));
    }

    // Attempt 2: still fails -> pending again.
    const r2 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0 + 1) });
    if (!r2.ok) throw new Error("expected ok");
    expect(r2.data.status).toBe("pending");
    if (r2.data.status === "pending") {
      expect(r2.data.attempt).toBe(2);
      expect(r2.data.retryInMs).toBe(computeBackoffMs(2));
    }

    // Attempt 3 == maxAttempts: dead-lettered. Dead-lettering is a failure result,
    // so it returns an err envelope (no data) with a namespaced code.
    const r3 = await runJob(jobId, alwaysFails, { jobStore, runStore, now: fixedNow(T0 + 2) });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error.code).toBe("jobs-workflows.JOB_DEAD");

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
    if (!enq.ok) throw new Error("expected ok");
    const jobId = enq.data.id as string;

    let calls = 0;
    const ok: JobHandler = async () => {
      calls += 1;
    };

    const first = await runJob(jobId, ok, { jobStore, runStore, now: fixedNow(T0) });
    if (!first.ok) throw new Error("expected ok");
    expect(first.data.status).toBe("succeeded");
    expect(calls).toBe(1);

    const second = await runJob(jobId, ok, { jobStore, runStore, now: fixedNow(T0 + 5) });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected ok");
    if ("skipped" in second.data) expect(second.data.skipped).toBe(true);
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
    if (!created.ok) throw new Error("expected ok");
    const scheduleId = created.data.id;

    // "now" is 3.5 intervals after the first run: several windows were missed.
    const now = T0 + Math.floor(3.5 * intervalMs);
    const res = await dueScheduledJobs({ scheduleStore, jobStore, now: fixedNow(now) });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.enqueued).toBe(1); // exactly one enqueue, not one per missed window
    const jobId = res.data.items[0].jobId;
    expect(jobId).toBeTruthy();

    // nextRunAt advanced strictly into the future.
    const sched = await scheduleStore.get(scheduleId);
    expect(Date.parse(sched!.nextRunAt)).toBeGreaterThan(now);

    // Re-running the catch-up at the same now is a no-op (schedule no longer due).
    const again = await dueScheduledJobs({ scheduleStore, jobStore, now: fixedNow(now) });
    if (!again.ok) throw new Error("expected ok");
    expect(again.data.enqueued).toBe(0);
  });

  it("lists schedules for operator consoles", async () => {
    const scheduleStore = createMemoryScheduleStore();
    await upsertSchedule(
      { type: "daily-task", payload: { scope: "billing" }, intervalMs: 86_400_000 },
      { scheduleStore, now: fixedNow(T0) }
    );

    const listed = await listSchedules({ scheduleStore, correlationId: "corr-schedules" });
    expect(listed.ok).toBe(true);
    expect(listed.meta.correlationId).toBe("corr-schedules");
    if (!listed.ok) throw new Error("expected ok");
    expect(listed.data.count).toBe(1);
    expect(listed.data.schedules[0].type).toBe("daily-task");
  });
});
