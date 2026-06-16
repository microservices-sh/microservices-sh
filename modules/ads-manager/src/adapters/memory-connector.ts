import type { AdsConnector } from "../ports";
import type { ConnectorContext, DateRange, InsightRow, NormalizedCampaign } from "../types";

// Deterministic in-memory connector for tests/demo. Optionally seeded with fixed
// campaigns + per-date insights so anomaly detection is reproducible.
export function createMemoryConnector(seed?: {
  campaigns?: NormalizedCampaign[];
  insightsByDate?: Record<string, InsightRow[]>; // date → rows
}): AdsConnector {
  const campaigns: NormalizedCampaign[] = seed?.campaigns ?? [
    { id: "c1", name: "Prospecting", status: "active", spendCents: 50000, impressions: 100000, clicks: 2000, ctr: 2, cpcCents: 25, conversions: 40 },
    { id: "c2", name: "Retargeting", status: "active", spendCents: 30000, impressions: 40000, clicks: 1600, ctr: 4, cpcCents: 19, conversions: 80 },
  ];

  return {
    async listCampaigns(_ctx: ConnectorContext, _externalRef: string, _range: DateRange) {
      return campaigns.map((c) => ({ ...c }));
    },
    async getInsights(_ctx: ConnectorContext, _externalRef: string, range: DateRange) {
      if (seed?.insightsByDate) return seed.insightsByDate[range.until] ?? [];
      // Default: one row per campaign for the range's `until` date.
      return campaigns.map<InsightRow>((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        date: range.until,
        spendCents: c.spendCents,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        ctr: c.ctr,
        cpcCents: c.cpcCents,
        roas: c.roas,
      }));
    },
  };
}
