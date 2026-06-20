import type {
  Job,
  JobFilter,
  JobRun,
  JobSchedule,
  WorkflowDefinition,
  WorkflowArtifact,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepEvent,
  WorkflowStepRun
} from "../types";

export interface JobStore {
  insert(job: Job): Promise<void>;
  get(id: string): Promise<Job | null>;
  // Idempotency lookup. Returns the existing job for a dedup key, if any.
  findByIdempotencyKey(key: string): Promise<Job | null>;
  // Persist mutable fields (status, attempts, runAt, lastError, updatedAt).
  update(job: Job): Promise<void>;
  // Pending jobs whose runAt <= now, oldest first. Drives the worker pull loop.
  listDue(nowIso: string, limit: number): Promise<Job[]>;
  list(filter: JobFilter): Promise<Job[]>;
}

export interface JobRunStore {
  // Append-only attempt log. Never updated or deleted.
  append(run: JobRun): Promise<void>;
  listForJob(jobId: string): Promise<JobRun[]>;
}

export interface ScheduleStore {
  upsert(schedule: JobSchedule): Promise<void>;
  get(id: string): Promise<JobSchedule | null>;
  // Schedules whose nextRunAt <= now.
  listDue(nowIso: string): Promise<JobSchedule[]>;
  list(): Promise<JobSchedule[]>;
}

// Optional fast path: notify a queue consumer that a job is ready. The D1 store
// remains the source of truth; the queue is only a wake-up signal.
export interface QueueProducer {
  send(jobId: string): Promise<void>;
}

export interface WorkflowDefinitionStore {
  insert(definition: WorkflowDefinition): Promise<void>;
  get(id: string): Promise<WorkflowDefinition | null>;
}

export interface WorkflowRunFilter {
  ownerId?: string;
  definitionId?: string;
  status?: WorkflowRunStatus;
  limit?: number;
}

export interface WorkflowRunStore {
  insert(run: WorkflowRun): Promise<void>;
  get(id: string): Promise<WorkflowRun | null>;
  getForOwner(ownerId: string, id: string): Promise<WorkflowRun | null>;
  findByIdempotencyKey(ownerId: string, key: string): Promise<WorkflowRun | null>;
  update(run: WorkflowRun): Promise<void>;
  list(filter: WorkflowRunFilter): Promise<WorkflowRun[]>;
}

export interface WorkflowStepRunStore {
  insert(stepRun: WorkflowStepRun): Promise<void>;
  get(id: string): Promise<WorkflowStepRun | null>;
  getForOwnerRunStep(ownerId: string, workflowRunId: string, stepId: string): Promise<WorkflowStepRun | null>;
  claimPending(ownerId: string, workflowRunId: string, stepId: string, nowIso: string): Promise<WorkflowStepRun | null>;
  update(stepRun: WorkflowStepRun): Promise<void>;
  listForRun(ownerId: string, workflowRunId: string): Promise<WorkflowStepRun[]>;
}

export interface WorkflowArtifactStore {
  insert(artifact: WorkflowArtifact): Promise<void>;
  listForRun(ownerId: string, workflowRunId: string): Promise<WorkflowArtifact[]>;
  listForStep(ownerId: string, workflowRunId: string, stepRunId: string): Promise<WorkflowArtifact[]>;
}

export interface WorkflowStepEventStore {
  append(event: WorkflowStepEvent): Promise<void>;
  listForRun(ownerId: string, workflowRunId: string, limit?: number): Promise<WorkflowStepEvent[]>;
}
