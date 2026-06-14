import { listDeliveriesFilterSchema } from "../schemas";
import type { DeliveryLogStore } from "../ports";

// Read the delivery log with optional filters. Requires webhook.read at the
// route layer.
export async function listDeliveries(input: unknown, deps: { deliveryLog: DeliveryLogStore }) {
  const parsed = listDeliveriesFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_DELIVERY_FILTER", message: "Delivery filter is invalid.", issues: parsed.error.issues }
    };
  }
  const deliveries = await deps.deliveryLog.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { deliveries } };
}
