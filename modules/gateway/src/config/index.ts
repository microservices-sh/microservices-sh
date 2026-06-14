import { z } from "zod";

export const configSchema = z.object({
  tokenTtlSeconds: z.number().int().positive().max(3600).default(60),
  rateLimit: z.number().int().positive().default(60),
  rateWindowSeconds: z.number().int().positive().default(60)
});

export const defaultConfig = {
  tokenTtlSeconds: 60,
  rateLimit: 60,
  rateWindowSeconds: 60
} satisfies z.infer<typeof configSchema>;
