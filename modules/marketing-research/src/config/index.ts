import { z } from "zod";

export const marketingResearchConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultChannels: z.array(z.string().min(1)).default(["hackernews", "reddit", "github"]),
  maxSignalsPerRun: z.number().int().positive().default(25),
  requireApprovalForRun: z.boolean().default(true)
});

export type MarketingResearchConfig = z.infer<typeof marketingResearchConfigSchema>;

export const defaultMarketingResearchConfig: MarketingResearchConfig = {
  enabled: true,
  defaultChannels: ["hackernews", "reddit", "github"],
  maxSignalsPerRun: 25,
  requireApprovalForRun: true
};
