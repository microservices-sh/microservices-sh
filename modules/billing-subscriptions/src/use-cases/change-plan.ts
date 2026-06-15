import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeSubscriptionChange } from "../hooks";
import { changePlanInputSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { DomainEvent, Subscription } from "../types";

// Switch a subscription to a different plan. Canceled subscriptions can't change.
// Stripe handles proration on its side; this mirrors the new plan locally.
export async function changePlan(
  input: unknown,
  deps: { store: BillingStore; now?: () => number; correlationId?: string; beforeChangeHooks?: ResolvedHook[] }
) {
  const meta = billingSubscriptionsMeta(deps);

  const parsed = changePlanInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_CHANGE_INPUT", message: "Change-plan input is invalid.", issues: parsed.error.issues }, meta);
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return err(404, { code: "billing-subscriptions.SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." }, meta);
  }
  if (sub.status === "canceled") {
    return err(409, { code: "billing-subscriptions.SUBSCRIPTION_CANCELED", message: "A canceled subscription cannot change plan." }, meta);
  }
  const plan = await deps.store.getPlan(parsed.data.newPlanId);
  if (!plan) {
    return err(404, { code: "billing-subscriptions.PLAN_NOT_FOUND", message: "Target plan not found." }, meta);
  }
  if (sub.planId === parsed.data.newPlanId) {
    return ok(200, { id: sub.id, planId: sub.planId, unchanged: true }, meta);
  }

  const configData = await beforeSubscriptionChange("change_plan", { ...sub, planId: parsed.data.newPlanId });
  if (!configData) {
    return err(409, { code: "billing-subscriptions.CHANGE_BLOCKED", message: "Change was blocked by beforeSubscriptionChange." }, meta);
  }

  const hooked = await runHooks(
    "beforeSubscriptionChange",
    configData,
    { correlationId: meta.correlationId, action: "change_plan" },
    deps.beforeChangeHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const finalSub = hooked.value as Subscription;

  sub.planId = finalSub.planId;
  sub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(sub);

  const event: DomainEvent = {
    name: "subscription.plan_changed",
    correlationId: meta.correlationId,
    payload: { id: sub.id, planId: sub.planId }
  };

  return ok(200, { id: sub.id, planId: sub.planId, event }, meta);
}
