import { recordUsageInputSchema } from "../schemas";
import type { BillingStore } from "../ports";
import type { UsageRecord } from "../types";

// Record metered usage against a subscription. Idempotent when an idempotencyKey
// is supplied, so a retried meter event is counted once (over-billing guard).
export async function recordUsage(input: unknown, deps: { store: BillingStore; now?: () => number }) {
  const parsed = recordUsageInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_USAGE_INPUT", message: "Usage input is invalid.", issues: parsed.error.issues } };
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." } };
  }

  if (parsed.data.idempotencyKey) {
    const fresh = await deps.store.recordUsageKey(parsed.data.idempotencyKey);
    if (!fresh) {
      return { ok: true as const, status: 200 as const, data: { deduped: true } };
    }
  }

  const record: UsageRecord = {
    id: "use_" + crypto.randomUUID().slice(0, 16),
    subscriptionId: parsed.data.subscriptionId,
    meter: parsed.data.meter,
    quantity: parsed.data.quantity,
    at: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await deps.store.insertUsage(record);

  return { ok: true as const, status: 201 as const, data: { id: record.id } };
}
