import { z } from "zod";

export const configSchema = z.object({
  // When true, the consume use case requires a valid signed envelope.
  requireSignedEnvelope: z.boolean().default(false),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  requireSignedEnvelope: false,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;
