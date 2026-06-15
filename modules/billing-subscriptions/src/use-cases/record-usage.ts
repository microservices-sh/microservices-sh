import { ok, err } from "@microservices-sh/connection-contract";
import { recordUsageInputSchema } from "../schemas";
import { billingSubscriptionsMeta } from "../meta";
import type { BillingStore } from "../ports";
import type { UsageRecord } from "../types";

// Result shape for recordUsage(): both the "created" and idempotent "deduped"
// paths return the same object so the use-case has a single ok branch. `id` is
// only present when a new usage row was actually inserted.
export interface RecordUsageResult {
  deduped: boolean;
  id?: string;
}

// Record metered usage against a subscription. Idempotent when an idempotencyKey
// is supplied, so a retried meter event is counted once (over-billing guard).
export async function recordUsage(input: unknown, deps: { store: BillingStore; now?: () => number; correlationId?: string }) {
  const meta = billingSubscriptionsMeta(deps);

  const parsed = recordUsageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "billing-subscriptions.INVALID_USAGE_INPUT", message: "Usage input is invalid.", issues: parsed.error.issues }, meta);
  }

  const sub = await deps.store.getSubscription(parsed.data.subscriptionId);
  if (!sub) {
    return err(404, { code: "billing-subscriptions.SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." }, meta);
  }

  if (parsed.data.idempotencyKey) {
    const fresh = await deps.store.recordUsageKey(parsed.data.idempotencyKey);
    if (!fresh) {
      const replayed: RecordUsageResult = { deduped: true };
      return ok(200, replayed, meta);
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

  const created: RecordUsageResult = { deduped: false, id: record.id };
  return ok(201, created, meta);
}
