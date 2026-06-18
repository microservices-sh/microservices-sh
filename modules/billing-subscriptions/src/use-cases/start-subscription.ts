import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { beforeSubscriptionChange, onSubscriptionActivated } from "../hooks";
import { startSubscriptionInputSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { DomainEvent, Subscription } from "../types";

// Start a subscription: trialing when trialDays > 0, otherwise active. Period
// dates are seeded from the plan interval (Stripe webhooks later overwrite them).
//
// Two layers of customization run before the row is written (Plan 25 §5):
//   1. the local config seam `beforeSubscriptionChange` (per-app override)
//   2. the cross-module `beforeSubscriptionChange` guard chain, injected by the
//      composed app via deps.beforeChangeHooks — guards may veto the transition.
export async function startSubscription(
  input: unknown,
  deps: {
    store: BillingStore;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    correlationId?: string;
    beforeChangeHooks?: ResolvedHook[];
  }
) {
  const meta = billingSubscriptionsMeta(deps);

  const parsed = startSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_SUBSCRIPTION_INPUT", message: "Subscription input is invalid.", issues: parsed.error.issues }, meta);
  }

  const plan = await deps.store.getPlan(parsed.data.planId);
  if (!plan) {
    return err(404, { code: "billing-subscriptions.PLAN_NOT_FOUND", message: "Plan not found." }, meta);
  }
  const existing = await deps.store.getOpenSubscriptionBySubscriber(parsed.data.subscriberId);
  if (existing) {
    return err(
      409,
      {
        code: "billing-subscriptions.SUBSCRIPTION_EXISTS",
        message: "Subscriber already has a non-canceled subscription."
      },
      meta
    );
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const trialing = parsed.data.trialDays > 0;
  const periodMs = trialing ? parsed.data.trialDays * 86_400_000 : plan.interval === "year" ? cfg.yearMs : cfg.monthMs;

  const sub: Subscription = {
    id: "sub_" + crypto.randomUUID().slice(0, 16),
    subscriberId: parsed.data.subscriberId,
    planId: parsed.data.planId,
    status: trialing ? "trialing" : "active",
    cancelAtPeriodEnd: false,
    currentPeriodStart: nowIso,
    currentPeriodEnd: new Date(nowMs + periodMs).toISOString(),
    stripeSubscriptionId: parsed.data.stripeSubscriptionId ?? null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const configData = await beforeSubscriptionChange("start", sub);
  if (!configData) {
    return err(409, { code: "billing-subscriptions.CHANGE_BLOCKED", message: "Start was blocked by beforeSubscriptionChange." }, meta);
  }

  const hooked = await runHooks(
    "beforeSubscriptionChange",
    configData,
    { correlationId: meta.correlationId, action: "start" },
    deps.beforeChangeHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const finalSub = hooked.value as Subscription;
  const existingAfterHooks = await deps.store.getOpenSubscriptionBySubscriber(finalSub.subscriberId);
  if (existingAfterHooks) {
    return err(
      409,
      {
        code: "billing-subscriptions.SUBSCRIPTION_EXISTS",
        message: "Subscriber already has a non-canceled subscription."
      },
      meta
    );
  }

  await deps.store.insertSubscription(finalSub);
  if (finalSub.status === "active") await onSubscriptionActivated(finalSub);

  const event: DomainEvent = {
    name: finalSub.status === "active" ? "subscription.activated" : "subscription.started",
    correlationId: meta.correlationId,
    payload: { id: finalSub.id, subscriberId: finalSub.subscriberId, planId: finalSub.planId, status: finalSub.status }
  };

  return ok(201, { id: finalSub.id, status: finalSub.status, currentPeriodEnd: finalSub.currentPeriodEnd, event }, meta);
}
