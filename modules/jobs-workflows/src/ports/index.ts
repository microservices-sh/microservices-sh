import type { Job, JobFilter, JobRun, JobSchedule } from "../types";

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
