export const marketingResearchPermissions = [
  "marketing.read",
  "marketing.run",
  "marketing.admin",
  "marketing.observe"
] as const;

export type MarketingResearchPermission = (typeof marketingResearchPermissions)[number];
