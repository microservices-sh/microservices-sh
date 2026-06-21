export const events = {
  emitted: [
    "membership-credits.tier_created",
    "membership-credits.membership_assigned",
    "membership-credits.membership_changed",
    "membership-credits.membership_cancelled",
    "membership-credits.membership_expired",
    "membership-credits.credit_recorded"
  ],
  consumed: []
} as const;

export const membershipCreditsEvents = events;
