# Jobs & Workflows Module

Status: `available` (v0.1.0) · Class: `platform` · Risk: `high`

Durable background jobs for Cloudflare Workers + D1. The async backbone other
modules build on (email retries, payment reconciliation, reminders, invoice
dunning, media processing). It encapsulates the three things AI agents reliably
get wrong with background work:

1. **Idempotent enqueue & execution** — a unique `idempotency_key` (enforced in
   D1, not just app code) stops duplicate jobs; finished jobs are never re-run
   under at-least-once queue redelivery. No double charges.
2. **Bounded backoff retries + dead-letter** — failures retry on exponential
   backoff up to `maxAttempts`, then move to `dead` for inspection instead of
   retrying forever (no retry storm / self-DDoS).
3. **Catch-up scheduling** — `dueScheduledJobs` advances a schedule past *now* so
   a missed cron window enqueues once, not once per missed window.

## Public surface

```ts
import {
  enqueueJob, runJob, runDueJobs, dueScheduledJobs, upsertSchedule, listJobs, listSchedules,
  createD1JobStore, createD1JobRunStore, createD1ScheduleStore, createCfQueueProducer
} from "@microservices-sh/jobs-workflows";
```

- `enqueueJob(input, { jobStore, queue?, now? })` — add a job; idempotent with `idempotencyKey`.
- `runJob(jobId, handler, { jobStore, runStore, now? })` — run one job with retry/dead-letter.
- `runDueJobs(handlers, { jobStore, runStore, batchSize?, now? })` — worker pull loop; call from a Cron Trigger or queue consumer.
- `dueScheduledJobs({ scheduleStore, jobStore, queue?, now? })` — enqueue due recurring jobs (catch-up).
- `upsertSchedule(input, { scheduleStore, now? })` — create/update a recurring schedule.
- `listJobs(filter, { jobStore })` — observability, incl. dead-letter view.
- `listSchedules({ scheduleStore })` — read schedule inventory for operator consoles.

## Wiring (host app)

```ts
const jobStore = createD1JobStore(env.DB);
const runStore = createD1JobRunStore(env.DB);

// enqueue (idempotent) on the request path
await enqueueJob({ type: "send-welcome", payload: { userId }, idempotencyKey: `welcome:${userId}` }, { jobStore });

// in the Cron Trigger (scheduled handler)
await dueScheduledJobs({ scheduleStore: createD1ScheduleStore(env.DB), jobStore });
await runDueJobs({ "send-welcome": async (p) => { await sendEmail(p.userId); } }, { jobStore, runStore });
```

## Resources

- D1 (`DB`): tables `jobs`, `job_runs`, `job_schedules` (migration `0001`).
- Queue (`JOBS_QUEUE`, optional): wake-up hint only; D1 is the source of truth.

## Verification

```bash
pnpm --filter @microservices-sh/jobs-workflows build
pnpm --filter @microservices-sh/jobs-workflows check:spec
```
