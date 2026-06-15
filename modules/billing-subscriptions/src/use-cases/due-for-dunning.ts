import { ok } from "@microservices-sh/connection-contract";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";

// Dunning source: subscriptions in past_due. Run on a jobs-workflows schedule and
// enqueue a retry/reminder job per result (key the job on subscription id + date).
export async function dueForDunning(deps: { store: BillingStore; limit?: number; correlationId?: string }) {
  const meta = billingSubscriptionsMeta(deps);
  const subscriptions = await deps.store.listByStatus("past_due", deps.limit ?? 100);
  return ok(200, { subscriptions, count: subscriptions.length }, meta);
}
