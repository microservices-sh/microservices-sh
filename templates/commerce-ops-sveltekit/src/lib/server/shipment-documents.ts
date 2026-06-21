import { expandProductComponents, type Product } from "@microservices-sh/product-catalog";
import type { SalesOrderWithLineItems } from "@microservices-sh/sales-order";
import type { ShipmentWithItems } from "@microservices-sh/shipment";
import type { ShipmentPrintData, ShipmentPrintItem } from "$lib/packing-slip";

export interface ShipmentDocumentData extends ShipmentPrintData {
  orderId: string | null;
}

export function salesOrderIdsForShipment(shipment: Pick<ShipmentWithItems, "externalSource" | "externalId" | "items">): string[] {
  const ids = new Set<string>();
  if (shipment.externalSource === "sales-order" && shipment.externalId) ids.add(shipment.externalId);
  for (const item of shipment.items) {
    if (item.sourceType === "sales-order") ids.add(item.sourceId);
  }
  return [...ids];
}

function printItemLabel(product: Product | null, fallback: string): string {
  return product?.alias || product?.name || fallback;
}

async function orderedPrintItems(
  locals: App.Locals,
  tenantId: string,
  items: ShipmentWithItems["items"]
): Promise<ShipmentPrintItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const product = item.productId ? await locals.productCatalogStore.getProduct(tenantId, item.productId) : null;
      return {
        sku: product?.sku ?? item.sku,
        description: printItemLabel(product, item.description),
        quantity: item.quantity
      };
    })
  );
}

async function pickListPrintItems(
  locals: App.Locals,
  tenantId: string,
  items: ShipmentWithItems["items"]
): Promise<ShipmentPrintItem[]> {
  const expanded: ShipmentPrintItem[] = [];
  for (const item of items) {
    if (!item.productId) {
      expanded.push({ sku: item.sku, description: item.description, quantity: item.quantity });
      continue;
    }

    const components = await expandProductComponents(
      { tenantId, productId: item.productId, quantity: item.quantity },
      { productCatalogStore: locals.productCatalogStore }
    );
    if (!components.ok || !components.data) {
      const product = await locals.productCatalogStore.getProduct(tenantId, item.productId);
      expanded.push({
        sku: product?.sku ?? item.sku,
        description: printItemLabel(product, item.description),
        quantity: item.quantity
      });
      continue;
    }

    for (const component of components.data.components) {
      const product = await locals.productCatalogStore.getProduct(tenantId, component.productId);
      expanded.push({
        sku: product?.sku ?? item.sku,
        description: printItemLabel(product, item.description),
        quantity: component.quantity
      });
    }
  }
  return expanded;
}

export async function buildShipmentPrintDocument(
  locals: App.Locals,
  tenantId: string,
  shipment: ShipmentWithItems,
  order: SalesOrderWithLineItems | null
): Promise<ShipmentDocumentData> {
  const snapshot = order?.customerSnapshot ?? null;
  const [items, pickItems] = await Promise.all([
    orderedPrintItems(locals, tenantId, shipment.items),
    pickListPrintItems(locals, tenantId, shipment.items)
  ]);

  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    notes: shipment.notes,
    createdAt: shipment.createdAt,
    orderId: order?.id ?? (shipment.externalSource === "sales-order" ? shipment.externalId : null),
    orderNumber: order?.orderNumber ?? (shipment.externalSource === "sales-order" ? shipment.externalId : null),
    orderStatus: order?.status ?? null,
    customerName: snapshot?.displayName ?? null,
    customerEmail: snapshot?.email ?? null,
    customerPhone: snapshot?.phone ?? null,
    shippingAddress: snapshot?.shippingAddress ?? snapshot?.billingAddress ?? null,
    orderNotes: order?.notes ?? null,
    items,
    pickItems
  };
}
