import { cancelOrderInputSchema } from "../schemas";
import { isoNow } from "../service";
import type { Actor, SalesOrder } from "../types";
import { err, hooks, invalidTransition, ok, type SalesOrderDeps } from "./shared";

export async function cancelOrder(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const parsed = cancelOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_CANCEL_INPUT", "Cancel order input is invalid.", parsed.error.issues);
  }

  const existing = await deps.salesOrderStore.getOrder(parsed.data.tenantId, parsed.data.orderId);
  if (!existing) return err(404, "sales-order.ORDER_NOT_FOUND", "Sales order not found.");

  const filtered = await hooks(deps).beforeSalesOrderCancel(input, existing);
  const reparsed = cancelOrderInputSchema.safeParse(filtered);
  if (!reparsed.success) {
    return err(400, "sales-order.INVALID_CANCEL_INPUT", "Cancel order input is invalid.", reparsed.error.issues);
  }

  if (existing.status === "cancelled") return ok(200, { order: existing, idempotent: true });
  if (existing.status === "invoiced") return invalidTransition(existing, "cancelled");

  const now = isoNow(deps.now);
  const order: SalesOrder = {
    ...existing,
    status: "cancelled",
    cancelledAt: now,
    cancelReason: reparsed.data.reason ?? null,
    updatedAt: now
  };

  await deps.salesOrderStore.updateOrder(order);
  const updated = { ...order, lineItems: existing.lineItems };
  await deps.salesOrderStore.writeEvent({
    eventName: "sales-order.order_cancelled",
    entityType: "sales-order",
    entityId: order.id,
    tenantId: order.tenantId,
    payload: { actorId: deps.actor?.id ?? null, previousStatus: existing.status, reason: order.cancelReason }
  });
  await hooks(deps).afterSalesOrderUpdated(updated);

  return ok(200, { order: updated, idempotent: false });
}
