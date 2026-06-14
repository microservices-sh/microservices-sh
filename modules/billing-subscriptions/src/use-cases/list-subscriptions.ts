import { listSubscriptionsFilterSchema } from "../schemas";
import type { BillingStore } from "../ports";

export async function listSubscriptions(input: unknown, deps: { store: BillingStore }) {
  const parsed = listSubscriptionsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues } };
  }
  const subscriptions = await deps.store.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { subscriptions, count: subscriptions.length } };
}
