import type { BillingStore } from "../ports";

// Dunning source: subscriptions in past_due. Run on a jobs-workflows schedule and
// enqueue a retry/reminder job per result (key the job on subscription id + date).
export async function dueForDunning(deps: { store: BillingStore; limit?: number }) {
  const subscriptions = await deps.store.listByStatus("past_due", deps.limit ?? 100);
  return { ok: true as const, status: 200 as const, data: { subscriptions, count: subscriptions.length } };
}
