import { ok, err } from "@microservices-sh/connection-contract";
import { listSubscriptionsFilterSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";

export async function listSubscriptions(input: unknown, deps: { store: BillingStore; correlationId?: string }) {
  const meta = billingSubscriptionsMeta(deps);
  const parsed = listSubscriptionsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }, meta);
  }
  const subscriptions = await deps.store.list(parsed.data);
  return ok(200, { subscriptions, count: subscriptions.length }, meta);
}
