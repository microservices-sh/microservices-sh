import { createDraftOrderInputSchema } from "../schemas";
import {
  calculateLineTotals,
  calculateOrderTotals,
  isoNow,
  normalizeCurrency,
  normalizeCustomerSnapshot,
  normalizeOptional,
  salesOrderId
} from "../service";
import type { Actor, SalesOrder, SalesOrderLineItem } from "../types";
import { err, hooks, ok, validateExternalPair, type SalesOrderDeps } from "./shared";

export async function createDraftOrder(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeSalesOrderCreate(input);
  const parsed = createDraftOrderInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_ORDER_INPUT", "Sales order input is invalid.", parsed.error.issues);
  }

  const externalId = normalizeOptional(parsed.data.externalId);
  const externalSource = normalizeOptional(parsed.data.externalSource);
  const externalError = validateExternalPair(externalSource, externalId);
  if (externalError) return externalError;

  if (externalId && externalSource) {
    const existing = await deps.salesOrderStore.findOrderByExternalRef(parsed.data.tenantId, externalSource, externalId);
    if (existing) {
      return err(409, "sales-order.EXTERNAL_REF_CONFLICT", "A sales order already uses this external reference.");
    }
  }

  const now = isoNow(deps.now);
  const orderId = salesOrderId("so");
  const currency = normalizeCurrency(parsed.data.currency);
  const lineItems: SalesOrderLineItem[] = [];

  for (const lineInput of parsed.data.lineItems) {
    const lineExternalId = normalizeOptional(lineInput.externalId);
    const lineExternalSource = normalizeOptional(lineInput.externalSource);
    const lineExternalError = validateExternalPair(lineExternalSource, lineExternalId);
    if (lineExternalError) return lineExternalError;

    const totals = calculateLineTotals({
      quantity: lineInput.quantity,
      unitPriceCents: lineInput.unitPriceCents,
      discountCents: lineInput.discountCents,
      taxCents: lineInput.taxCents
    });

    lineItems.push({
      id: salesOrderId("sol"),
      tenantId: parsed.data.tenantId,
      orderId,
      productId: normalizeOptional(lineInput.productId),
      sku: normalizeOptional(lineInput.sku),
      name: lineInput.name.trim(),
      description: lineInput.description ?? null,
      quantity: lineInput.quantity,
      unitPriceCents: lineInput.unitPriceCents,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      externalId: lineExternalId,
      externalSource: lineExternalSource,
      createdAt: now,
      updatedAt: now
    });
  }

  const totals = calculateOrderTotals(lineItems);
  const order: SalesOrder = {
    id: orderId,
    tenantId: parsed.data.tenantId,
    orderNumber: normalizeOptional(parsed.data.orderNumber),
    status: "draft",
    currency,
    customerId: normalizeOptional(parsed.data.customerId),
    customerSnapshot: normalizeCustomerSnapshot(parsed.data.customerSnapshot),
    externalId,
    externalSource,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    inventoryReservationId: null,
    invoiceId: null,
    notes: parsed.data.notes ?? null,
    createdById: deps.actor?.id ?? null,
    confirmedAt: null,
    cancelledAt: null,
    cancelReason: null,
    invoicedAt: null,
    lastSentAt: null,
    lastSentToEmail: null,
    lastSendStatus: null,
    lastEmailDeliveryId: null,
    createdAt: now,
    updatedAt: now
  };

  await deps.salesOrderStore.insertOrder(order, lineItems);
  await deps.salesOrderStore.writeEvent({
    eventName: "sales-order.order_created",
    entityType: "sales-order",
    entityId: order.id,
    tenantId: order.tenantId,
    payload: { actorId: deps.actor?.id ?? null, totalCents: order.totalCents, externalSource: order.externalSource }
  });

  const created = { ...order, lineItems };
  await hooks(deps).afterSalesOrderUpdated(created);
  return ok(201, { order: created });
}
