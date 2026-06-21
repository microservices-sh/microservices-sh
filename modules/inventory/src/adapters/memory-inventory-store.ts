import type { InventoryStore } from "../ports";
import type { InventoryEvent, StockBalance, StockMovement, StockMovementFilter } from "../types";

function cloneMovement(movement: StockMovement): StockMovement {
  return { ...movement };
}

function cloneEvent(event: InventoryEvent): InventoryEvent {
  return { ...event, payload: { ...event.payload } };
}

function sourceKey(movement: StockMovement): string | null {
  if (!movement.sourceType || !movement.sourceId) return null;
  return [
    movement.tenantId,
    movement.productId,
    movement.locationId,
    movement.movementType,
    movement.sourceType,
    movement.sourceId
  ].join("\u0000");
}

function matchesFilter(movement: StockMovement, filter: StockMovementFilter): boolean {
  return (
    movement.tenantId === filter.tenantId &&
    (!filter.productId || movement.productId === filter.productId) &&
    (!filter.locationId || movement.locationId === filter.locationId) &&
    (!filter.movementType || movement.movementType === filter.movementType) &&
    (!filter.sourceType || movement.sourceType === filter.sourceType) &&
    (!filter.sourceId || movement.sourceId === filter.sourceId)
  );
}

function emptyBalance(tenantId: string, productId: string, locationId: string): StockBalance {
  return { tenantId, productId, locationId, onHand: 0, reserved: 0, available: 0 };
}

export function createMemoryInventoryStore(): InventoryStore {
  const movements = new Map<string, StockMovement>();
  const sourceRefs = new Map<string, string>();
  const events: InventoryEvent[] = [];

  return {
    async insertMovement(movement) {
      const key = sourceKey(movement);
      if (key && sourceRefs.has(key)) {
        throw new Error(
          "UNIQUE constraint failed: inventory_stock_movements.tenant_id, inventory_stock_movements.product_id, inventory_stock_movements.location_id, inventory_stock_movements.movement_type, inventory_stock_movements.source_type, inventory_stock_movements.source_id"
        );
      }
      movements.set(movement.id, cloneMovement(movement));
      if (key) sourceRefs.set(key, movement.id);
    },

    async findMovementBySourceRef(tenantId, productId, locationId, movementType, sourceType, sourceId) {
      const key = [tenantId, productId, locationId, movementType, sourceType, sourceId].join("\u0000");
      const id = sourceRefs.get(key);
      const movement = id ? movements.get(id) : null;
      return movement ? cloneMovement(movement) : null;
    },

    async listMovements(filter) {
      return [...movements.values()]
        .filter((movement) => matchesFilter(movement, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, filter.limit ?? 100)
        .map(cloneMovement);
    },

    async getBalance(tenantId, productId, locationId) {
      const balance = emptyBalance(tenantId, productId, locationId);
      for (const movement of movements.values()) {
        if (
          movement.tenantId === tenantId &&
          movement.productId === productId &&
          movement.locationId === locationId
        ) {
          balance.onHand += movement.onHandDelta;
          balance.reserved += movement.reservedDelta;
        }
      }
      balance.available = balance.onHand - balance.reserved;
      return balance;
    },

    async writeEvent(event) {
      events.push(cloneEvent(event));
    }
  };
}
