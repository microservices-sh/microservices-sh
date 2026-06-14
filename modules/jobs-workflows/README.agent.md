# Agent Guide: Jobs & Workflows Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `JobStore` / `JobRunStore` / `ScheduleStore`, and the
   queue behind the `QueueProducer` port. Never make real I/O in tests — use the
   `createMemory*` adapters.
3. Preserve the three correctness invariants; they are the reason this module
   exists:
   - **Idempotent enqueue**: keep the `idempotency_key` unique index and the
     `findByIdempotencyKey` dedup path (including the post-insert race fallback).
   - **Idempotent execution**: `runJob` must skip jobs already `succeeded`/`dead`.
   - **Bounded retries**: retry with `computeBackoffMs` until `attempts >=
     maxAttempts`, then set status `dead` and call `onJobDead`. Never retry forever.
   - **Catch-up scheduling**: `dueScheduledJobs` advances `nextRunAt` past now via
     `nextScheduleTick` (one enqueue per missed window, not many).
4. The queue is a wake-up hint only. D1 is the source of truth; a queue send
   failure must not fail an enqueue.
5. Keep the `job_runs` log append-only.
6. Risk `high`: migrations, background side-effects, and production deploy are
   approval-gated.
7. Run `pnpm --filter @microservices-sh/jobs-workflows build` and `check:spec`
   after edits.
