import { beforeSubscriptionChange } from "../hooks";
import { changePlanInputSchema } from "../schemas";
import type { BillingStore } from "../ports";

// Switch a subscription to a different plan. Canceled subscriptions can't change.
// Stripe handles proration on its side; this mirrors the new plan locally.
export async function changePlan(input: unknown, deps: { store: BillingStore; now?: () => number }) {
  const parsed = changePlanInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_CHANGE_INPUT", message: "Change-plan input is invalid.", issues: parsed.error.issues } };
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." } };
  }
  if (sub.status === "canceled") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "SUBSCRIPTION_CANCELED", message: "A canceled subscription cannot change plan." } };
  }
  const plan = await deps.store.getPlan(parsed.data.newPlanId);
  if (!plan) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "PLAN_NOT_FOUND", message: "Target plan not found." } };
  }
  if (sub.planId === parsed.data.newPlanId) {
    return { ok: true as const, status: 200 as const, data: { id: sub.id, planId: sub.planId, unchanged: true } };
  }

  const hooked = await beforeSubscriptionChange("change_plan", { ...sub, planId: parsed.data.newPlanId });
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "CHANGE_BLOCKED", message: "Change was blocked by beforeSubscriptionChange." } };
  }

  sub.planId = parsed.data.newPlanId;
  sub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(sub);

  return { ok: true as const, status: 200 as const, data: { id: sub.id, planId: sub.planId } };
}
