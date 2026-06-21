import { getStockBalance, releaseReservation, reserveStock, type StockMovement } from "@microservices-sh/inventory";
import type { InventoryReservationPort, SalesOrderWithLineItems } from "@microservices-sh/sales-order";

const LOCATION_ID = "default";
const SOURCE_TYPE = "sales-order";

interface SalesOrderInventoryDeps {
  inventoryStore: App.Locals["inventoryStore"];
  productCatalogStore: App.Locals["productCatalogStore"];
  actorId: string;
  permissions: string[];
  now?: () => number;
}

function productReader(productCatalogStore: App.Locals["productCatalogStore"]) {
  return {
    async getProduct(tenantId: string, productId: string) {
      const product = await productCatalogStore.getProduct(tenantId, productId);
      return product ? { id: product.id, tenantId: product.tenantId, trackStock: product.trackStock } : null;
    }
  };
}

export function createSalesOrderInventoryReservationPort(deps: SalesOrderInventoryDeps): InventoryReservationPort {
  return {
    async reserveSalesOrder({ order }) {
      const aggregate = new Map<string, { productId: string; sku: string; quantity: number }>();
      for (const line of order.lineItems) {
        if (!line.productId) continue;
        const product = await deps.productCatalogStore.getProduct(order.tenantId, line.productId);
        if (!product) throw new Error(`Product ${line.productId} was not found for this company.`);
        if (!product.trackStock) continue;
        const current = aggregate.get(product.id);
        if (current) current.quantity += line.quantity;
        else aggregate.set(product.id, { productId: product.id, sku: product.sku, quantity: line.quantity });
      }

      const pending: Array<{ productId: string; sku: string; quantity: number }> = [];
      for (const item of aggregate.values()) {
        const existing = await deps.inventoryStore.findMovementBySourceRef(
          order.tenantId,
          item.productId,
          LOCATION_ID,
          "reservation",
          SOURCE_TYPE,
          order.id
        );
        if (!existing) pending.push(item);
      }

      for (const item of pending) {
        const balance = await getStockBalance(
          { tenantId: order.tenantId, productId: item.productId, locationId: LOCATION_ID },
          { inventoryStore: deps.inventoryStore }
        );
        if (!balance.ok || !balance.data) throw new Error(balance.ok ? "Could not inspect stock balance." : balance.error.message);
        if (balance.data.balance.available < item.quantity) {
          throw new Error(`Insufficient available stock for ${item.sku}: ${balance.data.balance.available} available, ${item.quantity} needed.`);
        }
      }

      const movementIds: string[] = [];
      for (const item of pending) {
        const reserved = await reserveStock(
          {
            tenantId: order.tenantId,
            productId: item.productId,
            locationId: LOCATION_ID,
            quantity: item.quantity,
            sourceType: SOURCE_TYPE,
            sourceId: order.id,
            reason: `Sales order ${order.orderNumber ?? order.id}`
          },
          {
            inventoryStore: deps.inventoryStore,
            productReader: productReader(deps.productCatalogStore),
            actor: { id: deps.actorId, permissions: deps.permissions },
            now: deps.now
          }
        );
        if (!reserved.ok) throw new Error(reserved.error.message);
        movementIds.push(reserved.data.movement.id);
      }

      return { reservationId: movementIds.length > 0 || aggregate.size > 0 ? `${SOURCE_TYPE}:${order.id}` : null };
    }
  };
}

export interface SalesOrderReservationReleaseSummary {
  releasedCount: number;
  idempotentCount: number;
  movementIds: string[];
}

export async function releaseSalesOrderReservations(
  order: SalesOrderWithLineItems,
  deps: SalesOrderInventoryDeps
): Promise<SalesOrderReservationReleaseSummary> {
  const seenProductIds = new Set<string>();
  const releasedMovements: StockMovement[] = [];
  let idempotentCount = 0;

  for (const line of order.lineItems) {
    if (!line.productId || seenProductIds.has(line.productId)) continue;
    seenProductIds.add(line.productId);

    const reservation = await deps.inventoryStore.findMovementBySourceRef(
      order.tenantId,
      line.productId,
      LOCATION_ID,
      "reservation",
      SOURCE_TYPE,
      order.id
    );
    if (!reservation) continue;

    const released = await releaseReservation(
      {
        tenantId: order.tenantId,
        productId: line.productId,
        locationId: LOCATION_ID,
        quantity: reservation.quantity,
        sourceType: SOURCE_TYPE,
        sourceId: order.id,
        reason: `Release sales order ${order.orderNumber ?? order.id}`
      },
      {
        inventoryStore: deps.inventoryStore,
        actor: { id: deps.actorId, permissions: deps.permissions },
        now: deps.now
      }
    );
    if (!released.ok) throw new Error(released.error.message);

    if (released.data.idempotent) idempotentCount += 1;
    else releasedMovements.push(released.data.movement);
  }

  return {
    releasedCount: releasedMovements.length,
    idempotentCount,
    movementIds: releasedMovements.map((movement) => movement.id)
  };
}
