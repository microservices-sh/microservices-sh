import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { createShipment, completeShipment, listShipments } from "@microservices-sh/shipment";
import { getOrder, listOrders } from "@microservices-sh/sales-order";
import { money } from "$lib/format";
import { buildShipmentPrintDocument, salesOrderIdsForShipment } from "$lib/server/shipment-documents";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { createShipmentInventoryPort } from "$lib/server/shipment-inventory";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function isReadyOrderStatus(status: string): boolean {
  return status === "confirmed" || status === "invoiced";
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
  const shipmentDocuments = await Promise.all(shipments.map(async (shipment) => {
    const order = salesOrderIdsForShipment(shipment)
      .map((id) => ordersById.get(id))
      .find(Boolean) ?? null;
    return buildShipmentPrintDocument(locals, activeOrgId, shipment, order);
  }));
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
          inventoryPort: createShipmentInventoryPort({
            inventoryStore: locals.inventoryStore,
            productCatalogStore: locals.productCatalogStore,
            salesOrderStore: locals.salesOrderStore,
            actorId: locals.user.id
          }),
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
