# Jobs & Workflows Module

Status: `available` (v0.1.0) · Class: `platform` · Risk: `high`

Durable background jobs and deterministic workflow runs for Cloudflare Workers +
D1. This is the async backbone other modules build on (email retries, payment
reconciliation, reminders, invoice dunning, media processing, approval flows,
and agent dispatch). It keeps orchestration deterministic while letting a step
call a tool, wait for approval, or dispatch an AI agent through a host-provided
handler.

For multi-tenant agent products, this module should own workflow state and
capability routing. Agent runtimes should be isolated executors, not the source
of truth for cross-user workflow state.

It encapsulates the things AI agents reliably get wrong with background work:

1. **Idempotent enqueue & execution** — a unique `idempotency_key` (enforced in
   D1, not just app code) stops duplicate jobs; finished jobs are never re-run
   under at-least-once queue redelivery. No double charges.
2. **Bounded backoff retries + dead-letter** — failures retry on exponential
   backoff up to `maxAttempts`, then move to `dead` for inspection instead of
   retrying forever (no retry storm / self-DDoS).
3. **Catch-up scheduling** — `dueScheduledJobs` advances a schedule past *now* so
   a missed cron window enqueues once, not once per missed window.
4. **Deterministic workflow state** — workflow runs snapshot their step
   definitions at start, so editing a definition cannot mutate an in-flight run.
5. **Waiting/resume gates** — agent and approval steps can return `waiting`; a
   later trusted callback resumes the exact step with an output and context
   patch.

## Public surface

```ts
import {
  enqueueJob, runJob, runDueJobs, dueScheduledJobs, upsertSchedule, listJobs, listSchedules,
  defineWorkflow, startWorkflowRun, runNextWorkflowStep, resumeWorkflowStep,
  recordWorkflowArtifact, listWorkflowArtifacts, appendWorkflowStepEvent, listWorkflowStepEvents,
  createD1JobStore, createD1JobRunStore, createD1ScheduleStore, createCfQueueProducer,
  createD1WorkflowDefinitionStore, createD1WorkflowRunStore, createD1WorkflowStepRunStore,
  createD1WorkflowArtifactStore, createD1WorkflowStepEventStore
} from "@microservices-sh/jobs-workflows";
```

- `enqueueJob(input, { jobStore, queue?, now? })` — add a job; idempotent with `idempotencyKey`.
- `runJob(jobId, handler, { jobStore, runStore, now? })` — run one job with retry/dead-letter.
- `runDueJobs(handlers, { jobStore, runStore, batchSize?, now? })` — worker pull loop; call from a Cron Trigger or queue consumer.
- `dueScheduledJobs({ scheduleStore, jobStore, queue?, now? })` — enqueue due recurring jobs (catch-up).
- `upsertSchedule(input, { scheduleStore, now? })` — create/update a recurring schedule.
- `listJobs(filter, { jobStore })` — observability, incl. dead-letter view.
- `listSchedules({ scheduleStore })` — read schedule inventory for operator consoles.
- `defineWorkflow(input, { definitionStore })` — store a versioned workflow definition.
- `startWorkflowRun(input, { definitionStore, runStore, stepRunStore })` — create an idempotent run and first pending step.
- `runNextWorkflowStep(runId, handlers, { ownerId, runStore, stepRunStore })` — execute the current step through a typed handler registry after an owner-scoped atomic claim.
- `resumeWorkflowStep(input, { runStore, stepRunStore })` — complete a waiting agent/approval step; `input.ownerId` scopes the resume to one tenant.
- `recordWorkflowArtifact(input, { artifactStore })` — persist durable workflow outputs such as reports, logs, diffs, files, and URLs.
- `appendWorkflowStepEvent(input, { eventStore })` — append runtime/operator events for audit and run detail timelines.

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

## Workflow wiring

```ts
const definitionStore = createD1WorkflowDefinitionStore(env.DB);
const workflowRunStore = createD1WorkflowRunStore(env.DB);
const stepRunStore = createD1WorkflowStepRunStore(env.DB);

const defined = await defineWorkflow({
  ownerId,
  name: "Research and approve",
  status: "active",
  steps: [
    { id: "research", kind: "agent", ref: "research", next: "approval" },
    { id: "approval", kind: "approval", ref: "operator" }
  ]
}, { definitionStore });

const started = await startWorkflowRun({
  ownerId,
  definitionId: defined.ok ? defined.data.definition.id : "",
  input: { topic: "data permissions" },
  idempotencyKey: `research:${ownerId}:data-permissions`
}, { definitionStore, runStore: workflowRunStore, stepRunStore });

await runNextWorkflowStep(started.ok ? started.data.run.id : "", {
  "agent:research": async (input) => {
    const agentRunId = await dispatchIsolatedAgent(input);
    return { status: "waiting", output: { agentRunId }, contextPatch: { agentRunId } };
  }
}, { ownerId, runStore: workflowRunStore, stepRunStore });

await resumeWorkflowStep({
  ownerId,
  workflowRunId: started.ok ? started.data.run.id : "",
  status: "succeeded",
  output: { reportId: "report_1" }
}, { runStore: workflowRunStore, stepRunStore });
```

## Resources

- D1 (`DB`): tables `jobs`, `job_runs`, `job_schedules` (migration `0001`) and
  `workflow_definitions`, `workflow_runs`, `workflow_step_runs` (migration
  `0002`), plus `workflow_artifacts` and `workflow_step_events` (migration
  `0003`).
- Queue (`JOBS_QUEUE`, optional): wake-up hint only; D1 is the source of truth.

## Verification

```bash
pnpm --filter @microservices-sh/jobs-workflows build
pnpm --filter @microservices-sh/jobs-workflows check:spec
```
