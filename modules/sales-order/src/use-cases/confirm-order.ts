import { salesOrderIdentitySchema } from "../schemas";
import { isoNow } from "../service";
import type { Actor, SalesOrder } from "../types";
import { err, hooks, invalidTransition, ok, type SalesOrderDeps } from "./shared";

export async function confirmOrder(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const parsed = salesOrderIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_CONFIRM_INPUT", "Confirm order input is invalid.", parsed.error.issues);
  }

  const existing = await deps.salesOrderStore.getOrder(parsed.data.tenantId, parsed.data.orderId);
  if (!existing) return err(404, "sales-order.ORDER_NOT_FOUND", "Sales order not found.");

  const filtered = await hooks(deps).beforeSalesOrderConfirm(input, existing);
  const reparsed = salesOrderIdentitySchema.safeParse(filtered);
  if (!reparsed.success) {
    return err(400, "sales-order.INVALID_CONFIRM_INPUT", "Confirm order input is invalid.", reparsed.error.issues);
  }

  if (existing.status === "confirmed") return ok(200, { order: existing, idempotent: true });
  if (existing.status !== "draft") return invalidTransition(existing, "confirmed");

  const reservationId = deps.inventoryReservationPort
    ? (await deps.inventoryReservationPort.reserveSalesOrder({ order: existing })).reservationId ?? null
    : null;
  const now = isoNow(deps.now);
  const order: SalesOrder = {
    ...existing,
    status: "confirmed",
    inventoryReservationId: reservationId ?? existing.inventoryReservationId,
    confirmedAt: now,
    updatedAt: now
  };

  await deps.salesOrderStore.updateOrder(order);
  const updated = { ...order, lineItems: existing.lineItems };
  await deps.salesOrderStore.writeEvent({
    eventName: "sales-order.order_confirmed",
    entityType: "sales-order",
    entityId: order.id,
    tenantId: order.tenantId,
    payload: {
      actorId: deps.actor?.id ?? null,
      reservationId: order.inventoryReservationId,
      totalCents: order.totalCents
    }
  });
  await hooks(deps).afterSalesOrderUpdated(updated);

  return ok(200, { order: updated, idempotent: false });
}
