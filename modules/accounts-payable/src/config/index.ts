import { z } from "zod";

export const accountsPayableConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD"),
  defaultPaymentTermsDays: z.number().int().min(0).max(365).default(30),
  requireBillApproval: z.boolean().default(false),
  defaultBillSeries: z.string().min(1).max(20).default("BILL"),
  defaultPaymentSeries: z.string().min(1).max(20).default("BP"),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const configSchema = accountsPayableConfigSchema;

export const defaultConfig = {
  enabled: true,
  defaultCurrency: "USD",
  defaultPaymentTermsDays: 30,
  requireBillApproval: false,
  defaultBillSeries: "BILL",
  defaultPaymentSeries: "BP",
  defaultListLimit: 100
} satisfies z.infer<typeof accountsPayableConfigSchema>;
