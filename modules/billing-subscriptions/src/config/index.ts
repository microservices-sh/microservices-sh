import { z } from "zod";

export const configSchema = z.object({
  defaultCurrency: z.string().length(3).default("USD"),
  // Period length used when starting a subscription without explicit Stripe dates.
  monthMs: z.number().int().positive().default(2_592_000_000),
  yearMs: z.number().int().positive().default(31_536_000_000),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  defaultCurrency: "USD",
  monthMs: 2_592_000_000,
  yearMs: 31_536_000_000,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;
