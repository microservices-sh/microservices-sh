import { defaultConfig } from "../config";
import { beforeSubscriptionChange, onSubscriptionActivated } from "../hooks";
import { startSubscriptionInputSchema } from "../schemas";
import type { BillingStore } from "../ports";
import type { Subscription } from "../types";

// Start a subscription: trialing when trialDays > 0, otherwise active. Period
// dates are seeded from the plan interval (Stripe webhooks later overwrite them).
export async function startSubscription(
  input: unknown,
  deps: { store: BillingStore; now?: () => number; config?: Partial<typeof defaultConfig> }
) {
  const parsed = startSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_SUBSCRIPTION_INPUT", message: "Subscription input is invalid.", issues: parsed.error.issues } };
  }

  const plan = await deps.store.getPlan(parsed.data.planId);
  if (!plan) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "PLAN_NOT_FOUND", message: "Plan not found." } };
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

  const hooked = await beforeSubscriptionChange("start", sub);
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "CHANGE_BLOCKED", message: "Start was blocked by beforeSubscriptionChange." } };
  }

  await deps.store.insertSubscription(hooked);
  if (hooked.status === "active") await onSubscriptionActivated(hooked);

  return { ok: true as const, status: 201 as const, data: { id: hooked.id, status: hooked.status, currentPeriodEnd: hooked.currentPeriodEnd } };
}
