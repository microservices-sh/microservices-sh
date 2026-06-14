import { z } from "zod";

export const configSchema = z.object({
  allowNotes: z.boolean().default(true),
  requirePhone: z.boolean().default(false)
});

export const defaultConfig = {
  allowNotes: true,
  requirePhone: false
} satisfies z.infer<typeof configSchema>;
