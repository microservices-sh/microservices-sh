import { getStockBalance, listStockMovements, releaseReservation, reserveStock, type StockMovement } from "@microservices-sh/inventory";
import { expandProductComponents } from "@microservices-sh/product-catalog";
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

function addStockItem(
  aggregate: Map<string, { productId: string; sku: string; quantity: number }>,
  item: { productId: string; sku: string; quantity: number }
) {
  const current = aggregate.get(item.productId);
  if (current) current.quantity += item.quantity;
  else aggregate.set(item.productId, { ...item });
}

export async function resolveTrackedStockItems(
  tenantId: string,
  items: Array<{ productId: string | null; quantity: number }>,
  productCatalogStore: App.Locals["productCatalogStore"]
): Promise<Array<{ productId: string; sku: string; quantity: number }>> {
  const aggregate = new Map<string, { productId: string; sku: string; quantity: number }>();

  for (const item of items) {
    if (!item.productId) continue;
    const expanded = await expandProductComponents(
      { tenantId, productId: item.productId, quantity: item.quantity },
      { productCatalogStore }
    );
    if (!expanded.ok || !expanded.data) {
      throw new Error(expanded.ok ? "Could not expand product components." : expanded.error.message);
    }

    for (const component of expanded.data.components) {
      if (!Number.isSafeInteger(component.quantity)) {
        throw new Error("Stock-tracked component quantities must resolve to whole units.");
      }
      const product = await productCatalogStore.getProduct(tenantId, component.productId);
      if (!product) throw new Error(`Product ${component.productId} was not found for this company.`);
      if (!product.trackStock) continue;
      addStockItem(aggregate, { productId: product.id, sku: product.sku, quantity: component.quantity });
    }
  }

  return [...aggregate.values()];
}

export function createSalesOrderInventoryReservationPort(deps: SalesOrderInventoryDeps): InventoryReservationPort {
  return {
    async reserveSalesOrder({ order }) {
      const stockItems = await resolveTrackedStockItems(order.tenantId, order.lineItems, deps.productCatalogStore);

      const pending: Array<{ productId: string; sku: string; quantity: number }> = [];
      for (const item of stockItems) {
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

      return { reservationId: movementIds.length > 0 || stockItems.length > 0 ? `${SOURCE_TYPE}:${order.id}` : null };
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
  const reservations = await listStockMovements(
    {
      tenantId: order.tenantId,
      locationId: LOCATION_ID,
      movementType: "reservation",
      sourceType: SOURCE_TYPE,
      sourceId: order.id,
      limit: 500
    },
    { inventoryStore: deps.inventoryStore }
  );
  if (!reservations.ok) throw new Error(reservations.error.message);

  const releasedMovements: StockMovement[] = [];
  let idempotentCount = 0;

  for (const reservation of reservations.data.movements) {
    const released = await releaseReservation(
      {
        tenantId: order.tenantId,
        productId: reservation.productId,
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
