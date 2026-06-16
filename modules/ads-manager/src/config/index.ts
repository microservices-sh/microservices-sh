import { z } from "zod";

export const adsManagerConfigSchema = z.object({
  // Trailing window (days) used as the anomaly baseline.
  baselineWindowDays: z.number().int().positive().max(90).default(7),
  // spend today >= multiplier * trailing avg → spend_spike.
  spendSpikeMultiplier: z.number().positive().default(2),
  // cpc today >= multiplier * trailing avg → cpc_spike.
  cpcSpikeMultiplier: z.number().positive().default(1.5),
  // spend >= this (cents) with zero conversions → zero_conv.
  zeroConvMinSpendCents: z.number().int().positive().default(2000),
  defaultListLimit: z.number().int().positive().max(500).default(100),
  // Snapshot retention (days) the host cleanup may enforce.
  snapshotRetentionDays: z.number().int().positive().default(180),
});

export type AdsManagerConfig = z.infer<typeof adsManagerConfigSchema>;

export const defaultConfig: AdsManagerConfig = {
  baselineWindowDays: 7,
  spendSpikeMultiplier: 2,
  cpcSpikeMultiplier: 1.5,
  zeroConvMinSpendCents: 2000,
  defaultListLimit: 100,
  snapshotRetentionDays: 180,
};

export const configSchema = adsManagerConfigSchema;
