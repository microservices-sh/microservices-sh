import { ok } from "@microservices-sh/connection-contract";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";

export async function listPlans(deps: { store: BillingStore; correlationId?: string }) {
  const meta = billingSubscriptionsMeta(deps);
  const plans = await deps.store.listPlans();
  return ok(200, { plans, count: plans.length }, meta);
}
