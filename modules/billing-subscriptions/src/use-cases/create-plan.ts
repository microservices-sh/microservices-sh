import { ok, err } from "@microservices-sh/connection-contract";
import { createPlanInputSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { Plan } from "../types";

export async function createPlan(
  input: unknown,
  deps: { store: BillingStore; now?: () => number; correlationId?: string }
) {
  const meta = billingSubscriptionsMeta(deps);

  const parsed = createPlanInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_PLAN_INPUT", message: "Plan input is invalid.", issues: parsed.error.issues }, meta);
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
  return ok(201, { id: plan.id }, meta);
}
