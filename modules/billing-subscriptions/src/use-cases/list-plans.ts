import type { BillingStore } from "../ports";

export async function listPlans(deps: { store: BillingStore }) {
  const plans = await deps.store.listPlans();
  return { ok: true as const, status: 200 as const, data: { plans, count: plans.length } };
}
