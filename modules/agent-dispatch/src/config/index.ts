import { z } from "zod";

export const configSchema = z.object({
  defaultTtlMs: z.number().int().positive().max(86_400_000).default(3_600_000)
});

export const defaultConfig = {
  defaultTtlMs: 3_600_000
} as const;
