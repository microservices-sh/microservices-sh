import { z } from "zod";

export const enqueueJobInputSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  // When set, enqueue is idempotent across retries/redeliveries.
  idempotencyKey: z.string().min(1).optional().nullable(),
  maxAttempts: z.number().int().positive().max(50).default(5),
  // Delay before the job is first eligible to run.
  delayMs: z.number().int().nonnegative().max(31_536_000_000).default(0)
});

export const upsertScheduleInputSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  intervalMs: z.number().int().positive().max(31_536_000_000),
  maxAttempts: z.number().int().positive().max(50).default(5),
  // First fire time; defaults to now + intervalMs when omitted.
  firstRunAt: z.string().datetime().optional()
});

export const listJobsFilterSchema = z.object({
  status: z.enum(["pending", "running", "succeeded", "dead"]).optional(),
  type: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type EnqueueJobInput = z.infer<typeof enqueueJobInputSchema>;
export type UpsertScheduleInput = z.infer<typeof upsertScheduleInputSchema>;
export type ListJobsFilter = z.infer<typeof listJobsFilterSchema>;
