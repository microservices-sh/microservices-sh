export const marketingResearchEvents = [
  "marketing.brief_created",
  "marketing.signal_alert"
] as const;

export type MarketingResearchEventName = (typeof marketingResearchEvents)[number];
