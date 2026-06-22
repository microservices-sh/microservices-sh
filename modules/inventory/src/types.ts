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

export type InventoryReconciliationDocumentStatus = "draft" | "completed";
export type InventoryReconciliationLineStatus = "pending" | "matched" | "adjusted";

export interface InventoryReconciliationDocument {
  id: string;
  tenantId: string;
  locationId: string;
  reference: string | null;
  reason: string | null;
  status: InventoryReconciliationDocumentStatus;
  createdById: string | null;
  completedById: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InventoryReconciliationLine {
  id: string;
  documentId: string;
  tenantId: string;
  productId: string;
  locationId: string;
  expectedQuantity: number;
  countedQuantity: number;
  differenceQuantity: number;
  status: InventoryReconciliationLineStatus;
  movementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryReconciliationDocumentWithLines extends InventoryReconciliationDocument {
  lines: InventoryReconciliationLine[];
}

export interface InventoryReconciliationDocumentFilter {
  tenantId: string;
  status?: InventoryReconciliationDocumentStatus;
  limit?: number;
}

export interface InventoryLowStockProductInput {
  id: string;
  sku?: string | null;
  name?: string | null;
  trackStock?: boolean;
  reorderPoint?: number | null;
}

export interface InventoryLowStockAlert {
  tenantId: string;
  productId: string;
  sku: string | null;
  name: string | null;
  locationId: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  shortage: number;
}

export type InventoryEventName =
  | "inventory.stock_received"
  | "inventory.stock_reserved"
  | "inventory.stock_released"
  | "inventory.stock_deducted"
  | "inventory.stock_reconciled"
  | "inventory.reconciliation_document_created"
  | "inventory.reconciliation_document_completed";

export interface InventoryEvent {
  eventName: InventoryEventName;
  entityType: "stock_movement" | "reconciliation_document";
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
