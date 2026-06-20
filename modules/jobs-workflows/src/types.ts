// A unit of background work. Lifecycle: pending -> running -> (succeeded | dead),
// with running -> pending re-queues on retry until attempts hit maxAttempts.
export type JobStatus = "pending" | "running" | "succeeded" | "dead";

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  // Dedup key. When set, enqueue is idempotent: a second enqueue with the same
  // key returns the existing job instead of creating a duplicate.
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  // ISO timestamp the job becomes eligible to run (now, or now + backoff/delay).
  runAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// Append-only record of a single execution attempt. Never updated or deleted.
export interface JobRun {
  id: string;
  jobId: string;
  attempt: number;
  status: "succeeded" | "failed";
  error: string | null;
  startedAt: string;
  finishedAt: string;
}

// A recurring schedule that enqueues a job every intervalMs. nextRunAt is
// advanced with catch-up semantics so a missed window does not silently vanish.
export interface JobSchedule {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  intervalMs: number;
  maxAttempts: number;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilter {
  status?: JobStatus;
  type?: string;
  limit?: number;
}

// Outcome a handler returns to runJob (throwing is also treated as a failure).
export type JobResult = void | { ok: boolean; error?: string };

// The work function an app supplies for a given job type. Framework-neutral.
export type JobHandler = (payload: Record<string, unknown>, job: Job) => Promise<JobResult>;

// A lifecycle event emitted by a use-case. Carries the correlationId from the
// Result meta so downstream consumers can stitch the whole job trace together
// (Plan 25 §4). `name` matches the manifest connections.events.emits set.
export type JobEventName = "job.enqueued" | "job.succeeded" | "job.retried" | "job.dead" | "job.scheduled";

export type WorkflowDefinitionStatus = "draft" | "active" | "archived";
export type WorkflowRunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "canceled";
export type WorkflowStepRunStatus = "pending" | "running" | "waiting" | "succeeded" | "failed" | "dead" | "skipped";
export type WorkflowStepKind = "tool" | "agent" | "approval" | "condition" | "wait" | "emit";

export interface WorkflowStepDefinition {
  id: string;
  kind: WorkflowStepKind;
  name?: string;
  // Handler reference. A host app can register "agent:research" or just
  // "research"; the runner also falls back to the step kind.
  ref?: string;
  input: Record<string, unknown>;
  maxAttempts: number;
  next: string | null;
  onSuccess: string | null;
  onFailure: string | null;
}

export interface WorkflowDefinition {
  id: string;
  ownerId: string;
  name: string;
  version: number;
  status: WorkflowDefinitionStatus;
  trigger: Record<string, unknown> | null;
  steps: WorkflowStepDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  ownerId: string;
  definitionId: string;
  definitionVersion: number;
  status: WorkflowRunStatus;
  trigger: Record<string, unknown>;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  currentStepId: string | null;
  idempotencyKey: string | null;
  // Snapshot of the definition steps used by this run. The runner never reads a
  // mutable definition after start, so in-flight runs stay deterministic.
  stepDefinitions: WorkflowStepDefinition[];
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface WorkflowStepRun {
  id: string;
  ownerId: string;
  workflowRunId: string;
  stepId: string;
  kind: WorkflowStepKind;
  status: WorkflowStepRunStatus;
  attempt: number;
  maxAttempts: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  runAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepContext {
  workflowRun: WorkflowRun;
  stepRun: WorkflowStepRun;
  step: WorkflowStepDefinition;
  correlationId: string;
  now: () => number;
}

export interface WorkflowStepResult {
  status?: "succeeded" | "waiting" | "failed";
  output?: Record<string, unknown>;
  error?: string;
  nextStepId?: string | null;
  contextPatch?: Record<string, unknown>;
}

export type WorkflowStepHandler = (
  input: Record<string, unknown>,
  context: WorkflowStepContext
) => Promise<void | WorkflowStepResult>;

export type WorkflowStepHandlerRegistry = Record<string, WorkflowStepHandler>;

export type WorkflowEventName =
  | "workflow.defined"
  | "workflow.started"
  | "workflow.step.succeeded"
  | "workflow.step.failed"
  | "workflow.waiting"
  | "workflow.succeeded"
  | "workflow.failed";

export interface DomainEvent {
  name: JobEventName | WorkflowEventName;
  correlationId: string;
  payload: Record<string, unknown>;
}
