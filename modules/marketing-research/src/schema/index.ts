export const tables = {
  marketingBriefs: "marketing_briefs",
  signalSnapshots: "signal_snapshots",
  domainEvents: "domain_events"
} as const;

export const d1Schema = {
  tables,
  migrations: ["migrations/0001_marketing_research.sql"]
} as const;
