import { z } from "zod";

export const configSchema = z.object({
  // Default retry ceiling for jobs enqueued without an explicit maxAttempts.
  defaultMaxAttempts: z.number().int().positive().max(50).default(5),
  // Base delay for exponential backoff, in milliseconds.
  backoffBaseMs: z.number().int().positive().max(3_600_000).default(1000),
  // Upper bound on a single backoff delay, in milliseconds.
  backoffCapMs: z.number().int().positive().max(86_400_000).default(300_000),
  // Max jobs a single worker pull claims per tick.
  pullBatchSize: z.number().int().positive().max(1000).default(25),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 1000,
  backoffCapMs: 300_000,
  pullBatchSize: 25,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;
