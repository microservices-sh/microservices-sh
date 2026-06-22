import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import {
  completeShipment,
  getShipment,
  listShipmentStatusTransitions,
  startShipmentProcessing
} from "@microservices-sh/shipment";
import { getOrder, type SalesOrderWithLineItems } from "@microservices-sh/sales-order";
import { humanizeEvent, relativeTime } from "$lib/format";
import { buildShipmentPrintDocument, salesOrderIdsForShipment } from "$lib/server/shipment-documents";
import { createShipmentInventoryPort } from "$lib/server/shipment-inventory";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "completed" ? "good" : status === "processing" ? "warn" : status === "cancelled" ? "bad" : "neutral";

const eventTone = (eventName: string): Tone => {
  if (eventName.includes("completed")) return "good";
  if (eventName.includes("cancelled") || eventName.includes("failed")) return "bad";
  if (eventName.includes("created")) return "info";
  return "neutral";
};

async function findRelatedOrder(
  tenantId: string,
  shipment: Parameters<typeof salesOrderIdsForShipment>[0],
  salesOrderStore: App.Locals["salesOrderStore"]
): Promise<SalesOrderWithLineItems | null> {
  for (const orderId of salesOrderIdsForShipment(shipment)) {
    const result = await getOrder({ tenantId, orderId }, { salesOrderStore });
    if (result.ok && result.data) return result.data.order;
  }
  return null;
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("shipment", platform);
  requireModule("sales-order", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const [shipmentResult, eventsResult, transitionsResult] = await Promise.all([
    getShipment({ tenantId: activeOrgId, shipmentId: params.id }, { shipmentStore: locals.shipmentStore }),
    listEvents({ entityType: "shipment", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore }),
    listShipmentStatusTransitions(
      { tenantId: activeOrgId, shipmentId: params.id, limit: 20 },
      { shipmentStore: locals.shipmentStore }
    )
  ]);
  if (!shipmentResult.ok || !shipmentResult.data) throw error(shipmentResult.status, shipmentResult.error.message);

  const shipment = shipmentResult.data.shipment;
  const order = await findRelatedOrder(activeOrgId, shipment, locals.salesOrderStore);
  const document = await buildShipmentPrintDocument(locals, activeOrgId, shipment, order);
  const events = eventsResult.ok ? eventsResult.data.events : [];
  const transitions = transitionsResult.ok ? transitionsResult.data.transitions : [];

  return {
    canManage,
    shipment: {
      ...shipment,
      displayNumber: shipment.shipmentNumber ?? shipment.id,
      tone: statusTone(shipment.status),
      created: relativeTime(shipment.createdAt, now),
      completed: shipment.completedAt ? relativeTime(shipment.completedAt, now) : null,
      itemCount: shipment.items.reduce((sum, item) => sum + item.quantity, 0)
    },
    order: order
      ? {
          id: order.id,
          orderNumber: order.orderNumber ?? order.id,
          status: order.status,
          customerName: order.customerSnapshot?.displayName ?? "Walk-in customer"
        }
      : null,
    printDocument: document,
    statusTransitions: transitions.map((transition) => ({
      id: transition.id,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      reason: transition.reason,
      actorId: transition.actorId,
      changed: relativeTime(transition.changedAt, now),
      tone: statusTone(transition.toStatus)
    })),
    timeline: events.map((event) => ({
      title: humanizeEvent(event.eventName),
      detail:
        typeof event.payload?.itemCount === "number"
          ? `${event.payload.itemCount} items`
          : typeof event.payload?.carrier === "string"
            ? event.payload.carrier
            : undefined,
      time: relativeTime(event.createdAt, now),
      tone: eventTone(event.eventName)
    }))
  };
};

export const actions: Actions = {
  startProcessing: async ({ params, locals, cookies, platform }) => {
    requireModule("shipment", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const result = await startShipmentProcessing(
      {
        tenantId: org.id,
        shipmentId: params.id,
        reason: "operator_started"
      },
      {
        shipmentStore: locals.shipmentStore,
        actor: { id: locals.user.id }
      }
    );
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "shipment.processing_started",
        actorId: locals.user.id,
        entityType: "shipment",
        entityId: result.data.shipment.id,
        source: "app/shipments/detail",
        payload: {
          replayed: result.data.replayed,
          itemCount: result.data.shipment.items.length
        }
      },
      { auditStore: locals.auditStore }
    );

    return { processingStarted: true };
  },

  complete: async ({ params, locals, cookies, platform }) => {
    requireModule("shipment", platform);
    requireModule("inventory", platform);
    requireModule("product-catalog", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    let result;
    try {
      result = await completeShipment(
        {
          tenantId: org.id,
          shipmentId: params.id,
          completionRef: `complete:${params.id}`
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
    } catch (err) {
      return fail(400, { error: err instanceof Error ? err.message : "Could not complete shipment." });
    }
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "shipment.completed",
        actorId: locals.user.id,
        entityType: "shipment",
        entityId: result.data.shipment.id,
        source: "app/shipments/detail",
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
