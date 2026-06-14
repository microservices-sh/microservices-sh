import type { SubscriptionStatus } from "./types";

// Map every Stripe subscription status to ours. Stripe emits incomplete and
// incomplete_expired too — unmapped statuses are the silent corruption agents
// leave; here they collapse to safe equivalents.
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
    case "incomplete":
      return "unpaid";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // Unknown future status: treat as unpaid (deny access) rather than active.
      return "unpaid";
  }
}

// A subscription grants access while trialing or active. past_due keeps access
// during the dunning grace window; unpaid/paused/canceled do not.
export function grantsAccess(status: SubscriptionStatus): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

// Statuses that are terminal — no further automatic transitions.
export function isTerminal(status: SubscriptionStatus): boolean {
  return status === "canceled";
}
