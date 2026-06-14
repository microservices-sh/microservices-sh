import { z } from "zod";

export const configSchema = z.object({
  defaultSeries: z.string().min(1).max(32).default("INV"),
  defaultCurrency: z.string().length(3).default("USD"),
  defaultTermsDays: z.number().int().min(0).max(365).default(14),
  // Zero-pad the numeric part to this width when formatting the number string.
  numberPadWidth: z.number().int().min(0).max(12).default(5),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  defaultSeries: "INV",
  defaultCurrency: "USD",
  defaultTermsDays: 14,
  numberPadWidth: 5,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;
