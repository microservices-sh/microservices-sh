import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";
import { createD1BillingStore } from "../src/adapters/d1-billing-store";
import { createPlan, startSubscription } from "../src";
import type { Subscription } from "../src/types";

const SCHEMA = readFileSync(new URL("../migrations/0001_billing_subscriptions.sql", import.meta.url), "utf8");
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

function loadDatabaseSync(): any | null {
  try {
    const require = createRequire(import.meta.url);
    return require("node:sqlite").DatabaseSync;
  } catch {
    return null;
  }
}

function wrapAsD1(db: any) {
  const makeStmt = (sql: string, params: unknown[]) => ({
    bind(...p: unknown[]) {
      return makeStmt(sql, p);
    },
    async first(col?: string) {
      const row = db.prepare(sql).get(...params);
      if (row == null) return null;
      return col == null ? row : (row[col] ?? null);
    },
    async all() {
      return { results: db.prepare(sql).all(...params), success: true, meta: {} };
    },
    async run() {
      const info = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    }
  });

  return {
    prepare(sql: string) {
      return makeStmt(sql, []);
    }
  };
}

const DatabaseSync = loadDatabaseSync();

describe.skipIf(!DatabaseSync)("D1BillingStore", () => {
  let store: ReturnType<typeof createD1BillingStore>;

  beforeEach(() => {
    const raw = new DatabaseSync(":memory:");
    raw.exec(SCHEMA);
    store = createD1BillingStore(wrapAsD1(raw) as any);
  });

  async function seedPlan() {
    const plan = await createPlan(
      { name: "Pro", priceCents: 2_900, currency: "USD", interval: "month" },
      { store, now: () => T0 }
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error("plan failed");
    return plan.data.id;
  }

  function subscription(overrides: Partial<Subscription> = {}): Subscription {
    const now = new Date(T0).toISOString();
    return {
      id: "sub_direct_1",
      subscriberId: "org_direct_1",
      planId: "plan_direct_1",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(T0 + 2_592_000_000).toISOString(),
      stripeSubscriptionId: null,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  it("rejects a second non-canceled subscription for one subscriber through the use case", async () => {
    const planId = await seedPlan();

    const first = await startSubscription(
      { subscriberId: "org_d1_1", planId, trialDays: 0, stripeSubscriptionId: "sub_stripe_d1_1" },
      { store, now: () => T0 }
    );
    expect(first.ok).toBe(true);

    const second = await startSubscription(
      { subscriberId: "org_d1_1", planId, trialDays: 14, stripeSubscriptionId: "sub_stripe_d1_2" },
      { store, now: () => T0 + 1_000 }
    );
    expect(second).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "billing-subscriptions.SUBSCRIPTION_EXISTS" }
    });
  });

  it("enforces one open subscription per subscriber in SQL", async () => {
    await store.insertPlan({
      id: "plan_direct_1",
      name: "Direct",
      priceCents: 1_000,
      currency: "USD",
      interval: "month",
      stripePriceId: null,
      features: [],
      status: "active",
      createdAt: new Date(T0).toISOString(),
      updatedAt: new Date(T0).toISOString()
    });
    await store.insertSubscription(subscription());

    await expect(store.insertSubscription(subscription({ id: "sub_direct_2", status: "past_due" }))).rejects.toThrow(/unique|constraint/i);
    await expect(store.insertSubscription(subscription({ id: "sub_direct_3", status: "canceled" }))).resolves.toBeUndefined();
  });
});
