import { beforeSubscriptionChange } from "../hooks";
import { cancelSubscriptionInputSchema } from "../schemas";
import type { BillingStore } from "../ports";

// Cancel a subscription. Default is at-period-end (keeps access until the period
// closes); atPeriodEnd=false cancels immediately.
export async function cancelSubscription(input: unknown, deps: { store: BillingStore; now?: () => number }) {
  const parsed = cancelSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_CANCEL_INPUT", message: "Cancel input is invalid.", issues: parsed.error.issues } };
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." } };
  }
  if (sub.status === "canceled") {
    return { ok: true as const, status: 200 as const, data: { id: sub.id, status: "canceled" as const, cancelAtPeriodEnd: false } };
  }

  const hooked = await beforeSubscriptionChange("cancel", sub);
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "CHANGE_BLOCKED", message: "Cancel was blocked by beforeSubscriptionChange." } };
  }

  if (parsed.data.atPeriodEnd) {
    sub.cancelAtPeriodEnd = true;
  } else {
    sub.status = "canceled";
    sub.cancelAtPeriodEnd = false;
  }
  sub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(sub);

  return { ok: true as const, status: 200 as const, data: { id: sub.id, status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd } };
}
