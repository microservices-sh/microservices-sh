export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "membership_credit_tiers",
      "customer_memberships",
      "customer_credit_balances",
      "credit_transactions",
      "membership_history",
      "domain_events"
    ]
  }
] as const;

export const membershipCreditsResources = resources;
