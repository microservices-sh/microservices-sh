import { z } from "zod";

export const platformSchema = z.enum(["meta", "google"]);

export const connectAccountInputSchema = z.object({
  tenantId: z.string().min(1),
  platform: platformSchema,
  adAccountId: z.string().min(1),
  displayName: z.string().max(200).optional().nullable(),
  // The upstream ads-service connection id (returned after the host did OAuth there).
  externalRef: z.string().min(1),
});

export const tenantOnlySchema = z.object({ tenantId: z.string().min(1) });

export const connectionRefSchema = z.object({
  tenantId: z.string().min(1),
  connectionId: z.string().min(1),
});

export const dateRangeSchema = z.object({
  since: z.string().min(8),
  until: z.string().min(8),
});

export const insightsQuerySchema = connectionRefSchema.extend({
  since: z.string().min(8),
  until: z.string().min(8),
});

export const syncInsightsInputSchema = connectionRefSchema.extend({
  date: z.string().min(8), // the day to snapshot (YYYY-MM-DD)
});

export const detectAnomaliesInputSchema = connectionRefSchema.extend({
  date: z.string().min(8),
});

export const listAlertsInputSchema = z.object({
  tenantId: z.string().min(1),
  acknowledged: z.boolean().optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export type ConnectAccountInput = z.infer<typeof connectAccountInputSchema>;
export type ConnectionRefInput = z.infer<typeof connectionRefSchema>;
export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;
export type SyncInsightsInput = z.infer<typeof syncInsightsInputSchema>;
export type DetectAnomaliesInput = z.infer<typeof detectAnomaliesInputSchema>;
export type ListAlertsInput = z.infer<typeof listAlertsInputSchema>;
