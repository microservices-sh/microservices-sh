import type {
  InventoryEvent,
  InventoryProductRef,
  StockBalance,
  StockMovement,
  StockMovementFilter,
  StockMovementType
} from "../types";

export interface InventoryProductReader {
  getProduct(tenantId: string, productId: string): Promise<InventoryProductRef | null>;
}

export interface InventoryStore {
  insertMovement(movement: StockMovement): Promise<void>;
  findMovementBySourceRef(
    tenantId: string,
    productId: string,
    locationId: string,
    movementType: StockMovementType,
    sourceType: string,
    sourceId: string
  ): Promise<StockMovement | null>;
  listMovements(filter: StockMovementFilter): Promise<StockMovement[]>;
  getBalance(tenantId: string, productId: string, locationId: string): Promise<StockBalance>;
  writeEvent(event: InventoryEvent): Promise<void>;
}
