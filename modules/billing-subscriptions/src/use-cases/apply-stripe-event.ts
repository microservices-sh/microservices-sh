import { onSubscriptionActivated, onSubscriptionPastDue } from "../hooks";
import { mapStripeStatus } from "../state";
import type { BillingStore } from "../ports";
import type { NormalizedBillingEvent, SubscriptionStatus } from "../types";

// Apply a normalized Stripe webhook to subscription state. Two things agents get
// wrong, both handled here:
//   1) Idempotency — the event id is recorded once; a redelivered webhook is a
//      no-op (no double-provisioning, no double emails).
//   2) The full status machine — every Stripe status maps to one of ours, not
//      just active/canceled. past_due/unpaid/paused/trialing are real states.
export async function applyStripeEvent(event: NormalizedBillingEvent, deps: { store: BillingStore; now?: () => number }) {
  const sub = await deps.store.getSubscriptionByStripeId(event.stripeSubscriptionId);
  if (!sub) {
    // Not recording the key: the event may have arrived before the subscription
    // was created, so a retry should be allowed to apply later.
    return { ok: false as const, status: 404 as const, data: null, error: { code: "SUBSCRIPTION_NOT_FOUND", message: "No subscription for that Stripe id." } };
  }

  const fresh = await deps.store.recordEventKey(event.id);
  if (!fresh) {
    return { ok: true as const, status: 200 as const, data: { id: sub.id, deduped: true } };
  }

  let next: SubscriptionStatus | null = null;
  if (event.type === "customer.subscription.deleted") next = "canceled";
  else if (event.type === "invoice.payment_failed") next = "past_due";
  else if (event.type === "invoice.payment_succeeded") next = "active";
  else if (event.stripeStatus) next = mapStripeStatus(event.stripeStatus);

  if (!next) {
    return { ok: true as const, status: 200 as const, data: { id: sub.id, applied: false } };
  }

  const previous = sub.status;
  sub.status = next;
  if (event.periodStart) sub.currentPeriodStart = event.periodStart;
  if (event.periodEnd) sub.currentPeriodEnd = event.periodEnd;
  sub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(sub);

  if (next === "active" && previous !== "active") await onSubscriptionActivated(sub);
  if (next === "past_due" && previous !== "past_due") await onSubscriptionPastDue(sub);

  return { ok: true as const, status: 200 as const, data: { id: sub.id, status: next, previous } };
}
