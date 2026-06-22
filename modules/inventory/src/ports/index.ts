import type {
  InventoryEvent,
  InventoryReconciliationDocument,
  InventoryReconciliationDocumentFilter,
  InventoryReconciliationDocumentWithLines,
  InventoryReconciliationLine,
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
  insertReconciliationDocument(
    document: InventoryReconciliationDocument,
    lines: InventoryReconciliationLine[]
  ): Promise<void>;
  getReconciliationDocument(
    tenantId: string,
    documentId: string
  ): Promise<InventoryReconciliationDocumentWithLines | null>;
  listReconciliationDocuments(filter: InventoryReconciliationDocumentFilter): Promise<InventoryReconciliationDocument[]>;
  markReconciliationDocumentCompleted(
    tenantId: string,
    documentId: string,
    completedAt: string,
    completedById: string | null,
    lines: Array<{ lineId: string; status: "matched" | "adjusted"; movementId: string | null }>
  ): Promise<void>;
  writeEvent(event: InventoryEvent): Promise<void>;
}
