import { createPlanInputSchema } from "../schemas";
import type { BillingStore } from "../ports";
import type { Plan } from "../types";

export async function createPlan(input: unknown, deps: { store: BillingStore; now?: () => number }) {
  const parsed = createPlanInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_PLAN_INPUT", message: "Plan input is invalid.", issues: parsed.error.issues } };
  }
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const plan: Plan = {
    id: "plan_" + crypto.randomUUID().slice(0, 16),
    name: parsed.data.name,
    priceCents: parsed.data.priceCents,
    currency: parsed.data.currency,
    interval: parsed.data.interval,
    stripePriceId: parsed.data.stripePriceId ?? null,
    features: parsed.data.features,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso
  };
  await deps.store.insertPlan(plan);
  return { ok: true as const, status: 201 as const, data: { id: plan.id } };
}
