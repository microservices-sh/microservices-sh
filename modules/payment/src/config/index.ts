import { z } from "zod";

export const configSchema = z.object({
  defaultCurrency: z.string().min(3).max(8).default("usd"),
  // When true, webhook handling requires a configured secret (no skip path).
  requireWebhookSecret: z.boolean().default(true),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  defaultCurrency: "usd",
  requireWebhookSecret: true,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;
