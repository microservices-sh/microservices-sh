import type { BillingStore } from "../ports";
import type { Plan, Subscription, UsageRecord } from "../types";

export function createMemoryBillingStore(): BillingStore {
  const plans = new Map<string, Plan>();
  const subs = new Map<string, Subscription>();
  const usage: UsageRecord[] = [];
  const eventKeys = new Set<string>();
  const usageKeys = new Set<string>();

  return {
    async insertPlan(plan) {
      plans.set(plan.id, { ...plan, features: [...plan.features] });
    },
    async getPlan(id) {
      const p = plans.get(id);
      return p ? { ...p, features: [...p.features] } : null;
    },
    async listPlans() {
      return [...plans.values()].filter((p) => p.status === "active").sort((a, b) => a.priceCents - b.priceCents).map((p) => ({ ...p, features: [...p.features] }));
    },

    async insertSubscription(sub) {
      subs.set(sub.id, { ...sub });
    },
    async getSubscription(id) {
      const s = subs.get(id);
      return s ? { ...s } : null;
    },
    async getSubscriptionByStripeId(stripeSubscriptionId) {
      for (const s of subs.values()) if (s.stripeSubscriptionId === stripeSubscriptionId) return { ...s };
      return null;
    },
    async getOpenSubscriptionBySubscriber(subscriberId) {
      const open = [...subs.values()]
        .filter((s) => s.subscriberId === subscriberId && s.status !== "canceled")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return open ? { ...open } : null;
    },
    async updateSubscription(sub) {
      if (subs.has(sub.id)) subs.set(sub.id, { ...sub });
    },
    async list(filter) {
      return [...subs.values()]
        .filter((s) => (!filter.subscriberId || s.subscriberId === filter.subscriberId) && (!filter.status || s.status === filter.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((s) => ({ ...s }));
    },
    async listByStatus(status, limit) {
      return [...subs.values()].filter((s) => s.status === status).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(0, limit).map((s) => ({ ...s }));
    },

    async recordEventKey(eventId) {
      if (eventKeys.has(eventId)) return false;
      eventKeys.add(eventId);
      return true;
    },

    async insertUsage(record) {
      usage.push({ ...record });
    },
    async recordUsageKey(key) {
      if (usageKeys.has(key)) return false;
      usageKeys.add(key);
      return true;
    },
    async sumUsage(subscriptionId, meter, sinceIso) {
      return usage.filter((u) => u.subscriptionId === subscriptionId && u.meter === meter && u.at >= sinceIso).reduce((sum, u) => sum + u.quantity, 0);
    }
  };
}
