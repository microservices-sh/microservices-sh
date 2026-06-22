import type { InventoryStore } from "../ports";
import type {
  InventoryEvent,
  InventoryReconciliationDocument,
  InventoryReconciliationDocumentFilter,
  InventoryReconciliationDocumentWithLines,
  InventoryReconciliationLine,
  StockBalance,
  StockMovement,
  StockMovementFilter
} from "../types";

function cloneMovement(movement: StockMovement): StockMovement {
  return { ...movement };
}

function cloneEvent(event: InventoryEvent): InventoryEvent {
  return { ...event, payload: { ...event.payload } };
}

function cloneDocument(document: InventoryReconciliationDocument): InventoryReconciliationDocument {
  return { ...document };
}

function cloneLine(line: InventoryReconciliationLine): InventoryReconciliationLine {
  return { ...line };
}

function cloneDocumentWithLines(
  document: InventoryReconciliationDocument,
  lines: InventoryReconciliationLine[]
): InventoryReconciliationDocumentWithLines {
  return { ...cloneDocument(document), lines: lines.map(cloneLine) };
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

function matchesDocumentFilter(
  document: InventoryReconciliationDocument,
  filter: InventoryReconciliationDocumentFilter
): boolean {
  return document.tenantId === filter.tenantId && (!filter.status || document.status === filter.status);
}

export function createMemoryInventoryStore(): InventoryStore {
  const movements = new Map<string, StockMovement>();
  const sourceRefs = new Map<string, string>();
  const documents = new Map<string, InventoryReconciliationDocument>();
  const documentLines = new Map<string, InventoryReconciliationLine[]>();
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

    async insertReconciliationDocument(document, lines) {
      if (documents.has(document.id)) {
        throw new Error("UNIQUE constraint failed: inventory_reconciliation_documents.id");
      }
      documents.set(document.id, cloneDocument(document));
      documentLines.set(document.id, lines.map(cloneLine));
    },

    async getReconciliationDocument(tenantId, documentId) {
      const document = documents.get(documentId);
      if (!document || document.tenantId !== tenantId) return null;
      return cloneDocumentWithLines(document, documentLines.get(documentId) ?? []);
    },

    async listReconciliationDocuments(filter) {
      return [...documents.values()]
        .filter((document) => matchesDocumentFilter(document, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, filter.limit ?? 100)
        .map(cloneDocument);
    },

    async markReconciliationDocumentCompleted(tenantId, documentId, completedAt, completedById, completedLines) {
      const document = documents.get(documentId);
      if (!document || document.tenantId !== tenantId) return;
      const completedByLine = new Map(completedLines.map((line) => [line.lineId, line]));
      documents.set(documentId, {
        ...document,
        status: "completed",
        completedAt,
        completedById
      });
      documentLines.set(
        documentId,
        (documentLines.get(documentId) ?? []).map((line) => {
          const completed = completedByLine.get(line.id);
          return completed
            ? { ...line, status: completed.status, movementId: completed.movementId, updatedAt: completedAt }
            : cloneLine(line);
        })
      );
    },

    async writeEvent(event) {
      events.push(cloneEvent(event));
    }
  };
}
