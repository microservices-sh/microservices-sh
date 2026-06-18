import type { BillingStore } from "../ports";
import type { Plan, PlanInterval, PlanStatus, Subscription, SubscriptionStatus, UsageRecord } from "../types";

function toPlan(r: Record<string, unknown>): Plan {
  return {
    id: String(r.id),
    name: String(r.name),
    priceCents: Number(r.price_cents ?? 0),
    currency: String(r.currency),
    interval: String(r.interval) as PlanInterval,
    stripePriceId: r.stripe_price_id ? String(r.stripe_price_id) : null,
    features: JSON.parse(String(r.features ?? "[]")) as string[],
    status: String(r.status) as PlanStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  };
}

function toSub(r: Record<string, unknown>): Subscription {
  return {
    id: String(r.id),
    subscriberId: String(r.subscriber_id),
    planId: String(r.plan_id),
    status: String(r.status) as SubscriptionStatus,
    cancelAtPeriodEnd: Number(r.cancel_at_period_end ?? 0) === 1,
    currentPeriodStart: r.current_period_start ? String(r.current_period_start) : null,
    currentPeriodEnd: r.current_period_end ? String(r.current_period_end) : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  };
}

const SUB_COLS =
  "id, subscriber_id, plan_id, status, cancel_at_period_end, current_period_start, current_period_end, stripe_subscription_id, created_at, updated_at";

export function createD1BillingStore(db: D1Database): BillingStore {
  return {
    async insertPlan(plan) {
      await db.prepare("INSERT INTO plans (id, name, price_cents, currency, interval, stripe_price_id, features, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(plan.id, plan.name, plan.priceCents, plan.currency, plan.interval, plan.stripePriceId, JSON.stringify(plan.features), plan.status, plan.createdAt, plan.updatedAt).run();
    },
    async getPlan(id) {
      const r = await db.prepare("SELECT * FROM plans WHERE id = ?").bind(id).first<Record<string, unknown>>();
      return r ? toPlan(r) : null;
    },
    async listPlans() {
      const res = await db.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY price_cents ASC").all<Record<string, unknown>>();
      return (res.results ?? []).map(toPlan);
    },

    async insertSubscription(sub) {
      await db.prepare(`INSERT INTO subscriptions (${SUB_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(sub.id, sub.subscriberId, sub.planId, sub.status, sub.cancelAtPeriodEnd ? 1 : 0, sub.currentPeriodStart, sub.currentPeriodEnd, sub.stripeSubscriptionId, sub.createdAt, sub.updatedAt).run();
    },
    async getSubscription(id) {
      const r = await db.prepare(`SELECT ${SUB_COLS} FROM subscriptions WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return r ? toSub(r) : null;
    },
    async getSubscriptionByStripeId(stripeSubscriptionId) {
      const r = await db.prepare(`SELECT ${SUB_COLS} FROM subscriptions WHERE stripe_subscription_id = ?`).bind(stripeSubscriptionId).first<Record<string, unknown>>();
      return r ? toSub(r) : null;
    },
    async getOpenSubscriptionBySubscriber(subscriberId) {
      const r = await db.prepare(`SELECT ${SUB_COLS} FROM subscriptions WHERE subscriber_id = ? AND status <> 'canceled' ORDER BY created_at DESC LIMIT 1`).bind(subscriberId).first<Record<string, unknown>>();
      return r ? toSub(r) : null;
    },
    async updateSubscription(sub) {
      await db.prepare(
        "UPDATE subscriptions SET plan_id = ?, status = ?, cancel_at_period_end = ?, current_period_start = ?, current_period_end = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?"
      ).bind(sub.planId, sub.status, sub.cancelAtPeriodEnd ? 1 : 0, sub.currentPeriodStart, sub.currentPeriodEnd, sub.stripeSubscriptionId, sub.updatedAt, sub.id).run();
    },
    async list(filter) {
      const clauses: string[] = [];
      const binds: unknown[] = [];
      if (filter.subscriberId) { clauses.push("subscriber_id = ?"); binds.push(filter.subscriberId); }
      if (filter.status) { clauses.push("status = ?"); binds.push(filter.status); }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const res = await db.prepare(`SELECT ${SUB_COLS} FROM subscriptions ${where} ORDER BY created_at DESC LIMIT ?`).bind(...binds, filter.limit ?? 100).all<Record<string, unknown>>();
      return (res.results ?? []).map(toSub);
    },
    async listByStatus(status, limit) {
      const res = await db.prepare(`SELECT ${SUB_COLS} FROM subscriptions WHERE status = ? ORDER BY updated_at ASC LIMIT ?`).bind(status, limit).all<Record<string, unknown>>();
      return (res.results ?? []).map(toSub);
    },

    async recordEventKey(eventId) {
      try {
        await db.prepare("INSERT INTO billing_events (event_id, recorded_at) VALUES (?, ?)").bind(eventId, new Date().toISOString()).run();
        return true;
      } catch {
        return false;
      }
    },

    async insertUsage(record) {
      await db.prepare("INSERT INTO usage_records (id, subscription_id, meter, quantity, at) VALUES (?, ?, ?, ?, ?)")
        .bind(record.id, record.subscriptionId, record.meter, record.quantity, record.at).run();
    },
    async recordUsageKey(key) {
      // Reuse the billing_events ledger (namespaced) for usage idempotency.
      try {
        await db.prepare("INSERT INTO billing_events (event_id, recorded_at) VALUES (?, ?)").bind(`usage:${key}`, new Date().toISOString()).run();
        return true;
      } catch {
        return false;
      }
    },
    async sumUsage(subscriptionId, meter, sinceIso) {
      const r = await db.prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM usage_records WHERE subscription_id = ? AND meter = ? AND at >= ?")
        .bind(subscriptionId, meter, sinceIso).first<{ total: number }>();
      return Number(r?.total ?? 0);
    }
  };
}
