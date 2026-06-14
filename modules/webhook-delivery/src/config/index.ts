import { z } from "zod";

export const configSchema = z.object({
  defaultListLimit: z.number().int().positive().max(500).default(100),
  // How many delivery attempts a caller-driven retry loop should make. The
  // module records each attempt; the route adapter / queue consumer drives retry.
  maxRetries: z.number().int().min(0).max(10).default(3)
});

export const defaultConfig = {
  defaultListLimit: 100,
  maxRetries: 3
} satisfies z.infer<typeof configSchema>;
