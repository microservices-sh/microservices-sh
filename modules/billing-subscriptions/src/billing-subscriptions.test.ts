import { describe, it, expect } from "vitest";
import {
  createPlan,
  startSubscription,
  applyStripeEvent,
  dueForDunning,
  mapStripeStatus,
  createMemoryBillingStore
} from "./index";
import type { NormalizedBillingEvent } from "./types";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedActiveSub(stripeSubscriptionId: string) {
  const store = createMemoryBillingStore();
  const plan = await createPlan(
    { name: "Pro", priceCents: 2999, currency: "USD", interval: "month" },
    { store, now: fixedNow(T0) }
  );
  const sub = await startSubscription(
    { subscriberId: "org-1", planId: plan.data!.id, trialDays: 0, stripeSubscriptionId },
    { store, now: fixedNow(T0) }
  );
  return { store, subId: sub.data!.id as string };
}

describe("billing-subscriptions: applyStripeEvent idempotency", () => {
  it("applies the same event id only once (deduped)", async () => {
    const { store } = await seedActiveSub("sub_stripe_1");

    const event: NormalizedBillingEvent = {
      id: "evt_1",
      type: "invoice.payment_failed",
      stripeSubscriptionId: "sub_stripe_1"
    };

    const first = await applyStripeEvent(event, { store, now: fixedNow(T0 + 1) });
    expect(first.ok).toBe(true);
    expect(first.data?.status).toBe("past_due");
    expect(first.data?.previous).toBe("active");

    const replay = await applyStripeEvent(event, { store, now: fixedNow(T0 + 2) });
    expect(replay.ok).toBe(true);
    expect(replay.data?.deduped).toBe(true);
  });
});

describe("billing-subscriptions: mapStripeStatus", () => {
  it("maps past_due, unpaid, and unknown statuses correctly", () => {
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("unpaid");
    expect(mapStripeStatus("incomplete")).toBe("unpaid");
    // Unknown future statuses collapse to a safe access-denying state.
    expect(mapStripeStatus("some_new_status")).toBe("unpaid");
  });
});

describe("billing-subscriptions: failed payment -> past_due and dunning", () => {
  it("moves a sub to past_due and dueForDunning surfaces it", async () => {
    const { store, subId } = await seedActiveSub("sub_stripe_2");

    const event: NormalizedBillingEvent = {
      id: "evt_fail",
      type: "invoice.payment_failed",
      stripeSubscriptionId: "sub_stripe_2"
    };
    const applied = await applyStripeEvent(event, { store, now: fixedNow(T0 + 1) });
    expect(applied.data?.status).toBe("past_due");

    const dunning = await dueForDunning({ store });
    expect(dunning.ok).toBe(true);
    expect(dunning.data?.count).toBe(1);
    expect(dunning.data?.subscriptions[0].id).toBe(subId);
  });
});
