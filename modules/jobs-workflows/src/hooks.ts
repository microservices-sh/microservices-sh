import { computeBackoffMs as defaultBackoff } from "./backoff";
import type { EnqueueJobInput } from "./schemas";
import type { Job } from "./types";

// Customization seam: inspect, mutate, or drop a job before it is enqueued.
// Return null to silently skip enqueueing. Default is pass-through.
export async function beforeJobEnqueue(input: EnqueueJobInput): Promise<EnqueueJobInput | null> {
  return input;
}

// Customization seam: override the retry backoff curve. Default is exponential
// with a 5-minute cap (see ./backoff).
export function computeBackoffMs(attempt: number): number {
  return defaultBackoff(attempt);
}

// Customization seam: react when a job exhausts its retries and is dead-lettered
// (e.g. page an operator, enqueue a notification). Default is a no-op.
export async function onJobDead(_job: Job): Promise<void> {
  return;
}
