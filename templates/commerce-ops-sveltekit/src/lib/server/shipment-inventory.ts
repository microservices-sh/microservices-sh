import { deductStock, getStockBalance } from "@microservices-sh/inventory";
import type { ShipmentInventoryPort } from "@microservices-sh/shipment";
import { resolveTrackedStockItems } from "./sales-order-inventory";

interface ShipmentInventoryDeps {
  inventoryStore: App.Locals["inventoryStore"];
  productCatalogStore: App.Locals["productCatalogStore"];
  salesOrderStore: App.Locals["salesOrderStore"];
  actorId: string;
  now?: () => number;
}

export function createShipmentInventoryPort(deps: ShipmentInventoryDeps): ShipmentInventoryPort {
  return {
    async deductShipment(input) {
      const aggregate = new Map<string, { productId: string; sku: string; quantity: number; consumeReserved: boolean }>();
      for (const item of input.items) {
        const order = item.sourceType === "sales-order"
          ? await deps.salesOrderStore.getOrder(input.tenantId, item.sourceId)
          : null;
        const consumeReserved = order?.status === "confirmed" && Boolean(order.inventoryReservationId);
        const stockItems = await resolveTrackedStockItems(
          input.tenantId,
          [{ productId: item.productId, quantity: item.quantity }],
          deps.productCatalogStore
        );

        for (const stockItem of stockItems) {
          const current = aggregate.get(stockItem.productId);
          if (current) {
            current.quantity += stockItem.quantity;
            current.consumeReserved = current.consumeReserved || consumeReserved;
          } else {
            aggregate.set(stockItem.productId, { ...stockItem, consumeReserved });
          }
        }
      }

      const pending: Array<{ productId: string; sku: string; quantity: number; consumeReserved: boolean }> = [];
      for (const item of aggregate.values()) {
        const existing = await deps.inventoryStore.findMovementBySourceRef(
          input.tenantId,
          item.productId,
          "default",
          "deduction",
          "shipment",
          input.shipmentId
        );
        if (!existing) pending.push(item);
      }

      for (const item of pending) {
        const balance = await getStockBalance(
          { tenantId: input.tenantId, productId: item.productId, locationId: "default" },
          { inventoryStore: deps.inventoryStore }
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
            inventoryStore: deps.inventoryStore,
            actor: { id: deps.actorId },
            now: deps.now
          }
        );
        if (!deducted.ok) throw new Error(deducted.error.message);
      }

      return { deductionRef: `shipment:${input.shipmentId}` };
    }
  };
}
