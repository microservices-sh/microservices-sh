export const manifest = {
  schemaVersion: "2026-06-13",
  id: "membership-credits",
  name: "Membership Credits",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped membership tiers, active customer memberships, customer credit balances, credit ledger transactions, and membership history.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
