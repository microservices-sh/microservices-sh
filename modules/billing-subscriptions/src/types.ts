export type PlanInterval = "month" | "year";
export type PlanStatus = "active" | "archived";

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: PlanInterval;
  stripePriceId: string | null;
  features: string[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

// The full set of states Stripe can put a subscription in. Modeling all of them
// — not just active/canceled — is the point: missing past_due/unpaid/trialing is
// how agent-built billing corrupts state and over/under-provisions access.
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled";

export interface Subscription {
  id: string;
  // The customer or org this subscription belongs to.
  subscriberId: string;
  planId: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  meter: string;
  quantity: number;
  at: string;
}

export interface SubscriptionFilter {
  subscriberId?: string;
  status?: SubscriptionStatus;
  limit?: number;
}

// A Stripe webhook normalized by the host (or the payment module) into the fields
// this module needs. Keeps the module free of the Stripe SDK.
export interface NormalizedBillingEvent {
  id: string;
  type: string;
  stripeSubscriptionId: string;
  stripeStatus?: string;
  periodStart?: string;
  periodEnd?: string;
}
