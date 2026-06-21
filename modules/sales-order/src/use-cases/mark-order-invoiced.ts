import { salesOrderIdentitySchema } from "../schemas";
import { isoNow } from "../service";
import type { Actor, SalesOrder } from "../types";
import { err, hooks, invalidTransition, ok, type SalesOrderDeps } from "./shared";

export async function markOrderInvoiced(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const parsed = salesOrderIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_INVOICE_INPUT", "Invoice order input is invalid.", parsed.error.issues);
  }

  const existing = await deps.salesOrderStore.getOrder(parsed.data.tenantId, parsed.data.orderId);
  if (!existing) return err(404, "sales-order.ORDER_NOT_FOUND", "Sales order not found.");

  const filtered = await hooks(deps).beforeSalesOrderInvoice(input, existing);
  const reparsed = salesOrderIdentitySchema.safeParse(filtered);
  if (!reparsed.success) {
    return err(400, "sales-order.INVALID_INVOICE_INPUT", "Invoice order input is invalid.", reparsed.error.issues);
  }

  if (existing.status === "invoiced") return ok(200, { order: existing, idempotent: true });
  if (existing.status !== "confirmed") return invalidTransition(existing, "invoiced");
  if (!deps.invoiceDraftPort) {
    return err(424, "sales-order.INVOICE_PORT_REQUIRED", "An invoice draft port is required to mark an order invoiced.");
  }

  const invoice = await deps.invoiceDraftPort.createDraftFromSalesOrder({ order: existing });
  const now = isoNow(deps.now);
  const order: SalesOrder = {
    ...existing,
    status: "invoiced",
    invoiceId: invoice.invoiceId,
    invoicedAt: now,
    updatedAt: now
  };

  await deps.salesOrderStore.updateOrder(order);
  const updated = { ...order, lineItems: existing.lineItems };
  await deps.salesOrderStore.writeEvent({
    eventName: "sales-order.order_invoiced",
    entityType: "sales-order",
    entityId: order.id,
    tenantId: order.tenantId,
    payload: { actorId: deps.actor?.id ?? null, invoiceId: order.invoiceId, invoiceNumber: invoice.invoiceNumber ?? null }
  });
  await hooks(deps).afterSalesOrderUpdated(updated);

  return ok(200, { order: updated, idempotent: false });
}
