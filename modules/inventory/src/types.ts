export type StockMovementType = "stock_in" | "reservation" | "release" | "deduction" | "adjustment";

export interface InventoryConfig {
  enabled: boolean;
  defaultLocationId: string;
}

export interface Actor {
  id: string;
  email?: string;
  permissions?: string[];
}

export interface StockSourceRef {
  sourceType: string;
  sourceId: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  movementType: StockMovementType;
  quantity: number;
  onHandDelta: number;
  reservedDelta: number;
  sourceType: string | null;
  sourceId: string | null;
  reason: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface StockBalance {
  tenantId: string;
  productId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface StockMovementFilter {
  tenantId: string;
  productId?: string;
  locationId?: string;
  movementType?: StockMovementType;
  sourceType?: string;
  sourceId?: string;
  limit?: number;
}

export type InventoryEventName =
  | "inventory.stock_received"
  | "inventory.stock_reserved"
  | "inventory.stock_released"
  | "inventory.stock_deducted"
  | "inventory.stock_reconciled";

export interface InventoryEvent {
  eventName: InventoryEventName;
  entityType: "stock_movement";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export interface InventoryProductRef {
  id: string;
  tenantId?: string;
  trackStock?: boolean;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
