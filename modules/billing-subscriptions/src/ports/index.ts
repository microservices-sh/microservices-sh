import type { Plan, Subscription, SubscriptionFilter, UsageRecord } from "../types";

export interface BillingStore {
  insertPlan(plan: Plan): Promise<void>;
  getPlan(id: string): Promise<Plan | null>;
  listPlans(): Promise<Plan[]>;

  insertSubscription(sub: Subscription): Promise<void>;
  getSubscription(id: string): Promise<Subscription | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  getOpenSubscriptionBySubscriber(subscriberId: string): Promise<Subscription | null>;
  updateSubscription(sub: Subscription): Promise<void>;
  list(filter: SubscriptionFilter): Promise<Subscription[]>;
  // Subscriptions in past_due — drives dunning/retry.
  listByStatus(status: Subscription["status"], limit: number): Promise<Subscription[]>;

  // Idempotent webhook ledger: returns false if this event id was already applied.
  recordEventKey(eventId: string): Promise<boolean>;

  insertUsage(record: UsageRecord): Promise<void>;
  // Idempotent usage: returns false if the key was already recorded.
  recordUsageKey(key: string): Promise<boolean>;
  sumUsage(subscriptionId: string, meter: string, sinceIso: string): Promise<number>;
}
