import { ok, err } from "@microservices-sh/connection-contract";
import { onSubscriptionActivated, onSubscriptionPastDue } from "../hooks";
import { mapStripeStatus } from "../state";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { DomainEvent, NormalizedBillingEvent, SubscriptionStatus } from "../types";

// Result shape for applyStripeEvent(): a single ok branch covering the deduped,
// no-op, and applied paths. `event` is only present when a status transition was
// actually applied.
export interface ApplyStripeEventResult {
  id: string;
  deduped?: boolean;
  applied?: boolean;
  status?: SubscriptionStatus;
  previous?: SubscriptionStatus;
  event?: DomainEvent;
}

// Apply a normalized Stripe webhook to subscription state. Two things agents get
// wrong, both handled here:
//   1) Idempotency — the event id is recorded once; a redelivered webhook is a
//      no-op (no double-provisioning, no double emails).
//   2) The full status machine — every Stripe status maps to one of ours, not
//      just active/canceled. past_due/unpaid/paused/trialing are real states.
export async function applyStripeEvent(
  event: NormalizedBillingEvent,
  deps: { store: BillingStore; now?: () => number; correlationId?: string }
) {
  const meta = billingSubscriptionsMeta(deps);

  const sub = await deps.store.getSubscriptionByStripeId(event.stripeSubscriptionId);
  if (!sub) {
    // Not recording the key: the event may have arrived before the subscription
    // was created, so a retry should be allowed to apply later.
    return err(404, { code: "billing-subscriptions.SUBSCRIPTION_NOT_FOUND", message: "No subscription for that Stripe id." }, meta);
  }

  const fresh = await deps.store.recordEventKey(event.id);
  if (!fresh) {
    const deduped: ApplyStripeEventResult = { id: sub.id, deduped: true };
    return ok(200, deduped, meta);
  }

  let next: SubscriptionStatus | null = null;
  if (event.type === "customer.subscription.deleted") next = "canceled";
  else if (event.type === "invoice.payment_failed") next = "past_due";
  else if (event.type === "invoice.payment_succeeded") next = "active";
  else if (event.stripeStatus) next = mapStripeStatus(event.stripeStatus);

  if (!next) {
    const noop: ApplyStripeEventResult = { id: sub.id, applied: false };
    return ok(200, noop, meta);
  }

  const previous = sub.status;
  sub.status = next;
  if (event.periodStart) sub.currentPeriodStart = event.periodStart;
  if (event.periodEnd) sub.currentPeriodEnd = event.periodEnd;
  sub.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateSubscription(sub);

  if (next === "active" && previous !== "active") await onSubscriptionActivated(sub);
  if (next === "past_due" && previous !== "past_due") await onSubscriptionPastDue(sub);

  let domainEvent: DomainEvent | undefined;
  if (next !== previous) {
    if (next === "active") domainEvent = { name: "subscription.activated", correlationId: meta.correlationId, payload: { id: sub.id, previous } };
    else if (next === "past_due") domainEvent = { name: "subscription.past_due", correlationId: meta.correlationId, payload: { id: sub.id, previous } };
    else if (next === "canceled") domainEvent = { name: "subscription.canceled", correlationId: meta.correlationId, payload: { id: sub.id, previous } };
  }

  const result: ApplyStripeEventResult = { id: sub.id, status: next, previous };
  if (domainEvent) result.event = domainEvent;
  return ok(200, result, meta);
}
