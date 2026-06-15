import { ok, err } from "@microservices-sh/connection-contract";
import { listDeliveriesFilterSchema } from "../schemas";
import { webhookDeliveryMeta } from "../meta";
import type { DeliveryLogStore } from "../ports";

// Read the delivery log with optional filters. Requires webhook.read at the
// route layer.
export async function listDeliveries(
  input: unknown,
  deps: { deliveryLog: DeliveryLogStore; now?: () => number; correlationId?: string }
) {
  const meta = webhookDeliveryMeta(deps);

  const parsed = listDeliveriesFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(
      400,
      {
        code: "webhook-delivery.INVALID_DELIVERY_FILTER",
        message: "Delivery filter is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }
  const deliveries = await deps.deliveryLog.list(parsed.data);
  return ok(200, { deliveries }, meta);
}
