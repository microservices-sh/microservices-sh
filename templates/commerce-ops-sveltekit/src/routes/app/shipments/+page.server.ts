import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { deductStock, getStockBalance } from "@microservices-sh/inventory";
import { createShipment, completeShipment, listShipments, type ShipmentInventoryPort } from "@microservices-sh/shipment";
import { getOrder, listOrders } from "@microservices-sh/sales-order";
import { money } from "$lib/format";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function isReadyOrderStatus(status: string): boolean {
  return status === "confirmed" || status === "invoiced";
}

function salesOrderIdsForShipment(shipment: { externalSource: string | null; externalId: string | null; items: Array<{ sourceType: string; sourceId: string }> }): string[] {
  const ids = new Set<string>();
  if (shipment.externalSource === "sales-order" && shipment.externalId) ids.add(shipment.externalId);
  for (const item of shipment.items) {
    if (item.sourceType === "sales-order") ids.add(item.sourceId);
  }
  return [...ids];
}

function inventoryPort(locals: App.Locals, actorId: string): ShipmentInventoryPort {
  return {
    async deductShipment(input) {
      const aggregate = new Map<string, { productId: string; quantity: number; consumeReserved: boolean }>();
      for (const item of input.items) {
        const current = aggregate.get(item.productId);
        const order = item.sourceType === "sales-order"
          ? await locals.salesOrderStore.getOrder(input.tenantId, item.sourceId)
          : null;
        const consumeReserved = Boolean(order?.inventoryReservationId);
        if (current) {
          current.quantity += item.quantity;
          current.consumeReserved = current.consumeReserved || consumeReserved;
        } else {
          aggregate.set(item.productId, { productId: item.productId, quantity: item.quantity, consumeReserved });
        }
      }

      const pending: Array<{ productId: string; sku: string; quantity: number; consumeReserved: boolean }> = [];
      for (const item of aggregate.values()) {
        const product = await locals.productCatalogStore.getProduct(input.tenantId, item.productId);
        if (!product) throw new Error(`Product ${item.productId} was not found for this company.`);
        if (!product.trackStock) continue;

        const existing = await locals.inventoryStore.findMovementBySourceRef(
          input.tenantId,
          item.productId,
          "default",
          "deduction",
          "shipment",
          input.shipmentId
        );
        if (!existing) pending.push({ ...item, sku: product.sku });
      }

      for (const item of pending) {
        const balance = await getStockBalance(
          { tenantId: input.tenantId, productId: item.productId, locationId: "default" },
          { inventoryStore: locals.inventoryStore }
        );
        if (!balance.ok || !balance.data) throw new Error(balance.ok ? "Could not inspect stock balance." : balance.error.message);
        const availableQuantity = item.consumeReserved ? balance.data.balance.reserved : balance.data.balance.available;
        if (availableQuantity < item.quantity) {
          const quantityLabel = item.consumeReserved ? "reserved" : "available";
          throw new Error(
            `Insufficient ${quantityLabel} stock for ${item.sku}: ${availableQuantity} ${quantityLabel}, ${item.quantity} needed.`
          );
        }
      }

      for (const item of pending) {
        const deducted = await deductStock(
          {
            tenantId: input.tenantId,
            productId: item.productId,
            locationId: "default",
            quantity: item.quantity,
            consumeReserved: item.consumeReserved,
            sourceType: "shipment",
            sourceId: input.shipmentId,
            reason: `Shipment ${input.shipmentId}`
          },
          {
            inventoryStore: locals.inventoryStore,
            actor: { id: actorId }
          }
        );
        if (!deducted.ok) throw new Error(deducted.error.message);
      }

      return { deductionRef: `shipment:${input.shipmentId}` };
    }
  };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("shipment", platform);
  requireModule("sales-order", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [shipmentsResult, ordersResult] = await Promise.all([
    listShipments(
      { tenantId: activeOrgId, includeCancelled: true, limit: 100 },
      { shipmentStore: locals.shipmentStore }
    ),
    listOrders({ tenantId: activeOrgId, limit: 100 }, { salesOrderStore: locals.salesOrderStore })
  ]);
  const orders = ordersResult.ok ? ordersResult.data.orders : [];
  const shipments = shipmentsResult.ok ? shipmentsResult.data.shipments : [];
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const shipmentDocuments = shipments.map((shipment) => {
    const order = salesOrderIdsForShipment(shipment)
      .map((id) => ordersById.get(id))
      .find(Boolean);
    const snapshot = order?.customerSnapshot ?? null;
    return {
      shipmentId: shipment.id,
      orderNumber: order?.orderNumber ?? (shipment.externalSource === "sales-order" ? shipment.externalId : null),
      orderStatus: order?.status ?? null,
      customerName: snapshot?.displayName ?? null,
      customerEmail: snapshot?.email ?? null,
      customerPhone: snapshot?.phone ?? null,
      shippingAddress: snapshot?.shippingAddress ?? snapshot?.billingAddress ?? null,
      orderNotes: order?.notes ?? null
    };
  });
  const shippedOrderIds = new Set(
    shipments
      .filter((shipment) => shipment.status !== "cancelled")
      .flatMap((shipment) =>
        shipment.items
          .filter((item) => item.sourceType === "sales-order")
          .map((item) => item.sourceId)
      )
  );
  const readyOrders = ordersResult.ok
    ? orders
        .filter((order) => isReadyOrderStatus(order.status) && !shippedOrderIds.has(order.id))
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customerSnapshot?.displayName ?? "Walk-in customer",
          total: money(order.totalCents, order.currency),
          lineCount: order.lineItems.length,
          quantity: order.lineItems.reduce((sum, item) => sum + item.quantity, 0)
        }))
    : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    shipments,
    shipmentDocuments,
    readyOrders
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("shipment", platform);
    requireModule("sales-order", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      salesOrderId: text(form.get("salesOrderId")),
      shipmentNumber: text(form.get("shipmentNumber")),
      carrier: text(form.get("carrier")),
      trackingNumber: text(form.get("trackingNumber")),
      notes: text(form.get("notes"))
    };
    if (!values.salesOrderId) {
      return fail(400, { error: "Select a confirmed or invoiced sales order.", values });
    }

    const orderResult = await getOrder(
      { tenantId: org.id, orderId: values.salesOrderId },
      { salesOrderStore: locals.salesOrderStore }
    );
    if (!orderResult.ok || !orderResult.data) {
      return fail(orderResult.status, { error: orderResult.error.message, values });
    }
    const order = orderResult.data.order;
    if (!isReadyOrderStatus(order.status)) {
      return fail(409, { error: "Only confirmed or invoiced sales orders can be shipped.", values });
    }
    if (order.lineItems.length === 0) {
      return fail(400, { error: "The selected sales order has no line items.", values });
    }

    const result = await createShipment(
      {
        tenantId: org.id,
        shipmentNumber: values.shipmentNumber || null,
        carrier: values.carrier || null,
        trackingNumber: values.trackingNumber || null,
        notes: values.notes || null,
        externalSource: "sales-order",
        externalId: order.id,
        items: order.lineItems.map((item) => ({
          sourceType: "sales-order",
          sourceId: order.id,
          productId: item.productId,
          sku: item.sku,
          description: item.description || item.name,
          quantity: item.quantity
        }))
      },
      {
        shipmentStore: locals.shipmentStore,
        actor: { id: locals.user.id }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "shipment.created",
        actorId: locals.user.id,
        entityType: "shipment",
        entityId: result.data.shipment.id,
        source: "app/shipments",
        payload: {
          salesOrderId: order.id,
          itemCount: result.data.shipment.items.length,
          carrier: values.carrier || null
        }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  },

  complete: async ({ request, locals, cookies, platform }) => {
    requireModule("shipment", platform);
    requireModule("inventory", platform);
    requireModule("product-catalog", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const shipmentId = text(form.get("shipmentId"));
    if (!shipmentId) return fail(400, { error: "Missing shipment id." });

    let result;
    try {
      result = await completeShipment(
        {
          tenantId: org.id,
          shipmentId,
          completionRef: `complete:${shipmentId}`
        },
        {
          shipmentStore: locals.shipmentStore,
          inventoryPort: inventoryPort(locals, locals.user.id),
          actor: { id: locals.user.id }
        }
      );
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Could not complete shipment." });
    }
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "shipment.completed",
        actorId: locals.user.id,
        entityType: "shipment",
        entityId: result.data.shipment.id,
        source: "app/shipments",
        payload: {
          replayed: result.data.replayed,
          inventoryDeductionRef: result.data.shipment.inventoryDeductionRef,
          itemCount: result.data.shipment.items.length
        }
      },
      { auditStore: locals.auditStore }
    );

    return { completed: true };
  }
};
