import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeSubscriptionChange } from "../hooks";
import { cancelSubscriptionInputSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { DomainEvent, Subscription, SubscriptionStatus } from "../types";

// Result shape for cancelSubscription(): a single ok branch. `event` is only
// present when the subscription was actually canceled (immediate path).
export interface CancelResult {
  id: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  event?: DomainEvent;
}

// Cancel a subscription. Default is at-period-end (keeps access until the period
// closes); atPeriodEnd=false cancels immediately.
export async function cancelSubscription(
  input: unknown,
  deps: { store: BillingStore; now?: () => number; correlationId?: string; beforeChangeHooks?: ResolvedHook[] }
) {
  const meta = billingSubscriptionsMeta(deps);

  const parsed = cancelSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_CANCEL_INPUT", message: "Cancel input is invalid.", issues: parsed.error.issues }, meta);
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return err(404, { code: "billing-subscriptions.SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." }, meta);
  }
  if (sub.status === "canceled") {
    const already: CancelResult = { id: sub.id, status: "canceled", cancelAtPeriodEnd: false };
    return ok(200, already, meta);
  }

  const configData = await beforeSubscriptionChange("cancel", sub);
  if (!configData) {
    return err(409, { code: "billing-subscriptions.CHANGE_BLOCKED", message: "Cancel was blocked by beforeSubscriptionChange." }, meta);
  }

  const hooked = await runHooks(
    "beforeSubscriptionChange",
    configData,
    { correlationId: meta.correlationId, action: "cancel" },
    deps.beforeChangeHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const finalSub = hooked.value as Subscription;

  if (parsed.data.atPeriodEnd) {
    finalSub.cancelAtPeriodEnd = true;
  } else {
    finalSub.status = "canceled";
    finalSub.cancelAtPeriodEnd = false;
  }
  finalSub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(finalSub);

  const result: CancelResult = { id: finalSub.id, status: finalSub.status, cancelAtPeriodEnd: finalSub.cancelAtPeriodEnd };
  if (finalSub.status === "canceled") {
    result.event = {
      name: "subscription.canceled",
      correlationId: meta.correlationId,
      payload: { id: finalSub.id, subscriberId: finalSub.subscriberId }
    };
  }

  return ok(200, result, meta);
}
