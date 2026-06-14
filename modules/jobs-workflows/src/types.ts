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
