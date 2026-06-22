import type { InventoryStore } from "../ports";
import { inventoryId } from "../service";
import type {
  InventoryReconciliationDocument,
  InventoryReconciliationDocumentStatus,
  InventoryReconciliationDocumentWithLines,
  InventoryReconciliationLine,
  InventoryReconciliationLineStatus,
  StockBalance,
  StockMovement,
  StockMovementFilter,
  StockMovementType
} from "../types";

const MOVEMENT_COLUMNS =
  "id, tenant_id, product_id, location_id, movement_type, quantity, on_hand_delta, reserved_delta, source_type, source_id, reason, created_by_id, created_at";
const DOCUMENT_COLUMNS =
  "id, tenant_id, location_id, reference, reason, status, created_by_id, completed_by_id, created_at, completed_at";
const LINE_COLUMNS =
  "id, document_id, tenant_id, product_id, location_id, expected_quantity, counted_quantity, difference_quantity, status, movement_id, created_at, updated_at";

function rowToMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    productId: String(row.product_id),
    locationId: String(row.location_id),
    movementType: String(row.movement_type) as StockMovementType,
    quantity: Number(row.quantity ?? 0),
    onHandDelta: Number(row.on_hand_delta ?? 0),
    reservedDelta: Number(row.reserved_delta ?? 0),
    sourceType: row.source_type == null ? null : String(row.source_type),
    sourceId: row.source_id == null ? null : String(row.source_id),
    reason: row.reason == null ? null : String(row.reason),
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    createdAt: String(row.created_at)
  };
}

function emptyBalance(tenantId: string, productId: string, locationId: string): StockBalance {
  return { tenantId, productId, locationId, onHand: 0, reserved: 0, available: 0 };
}

function rowToDocument(row: Record<string, unknown>): InventoryReconciliationDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    locationId: String(row.location_id),
    reference: row.reference == null ? null : String(row.reference),
    reason: row.reason == null ? null : String(row.reason),
    status: String(row.status) as InventoryReconciliationDocumentStatus,
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    completedById: row.completed_by_id == null ? null : String(row.completed_by_id),
    createdAt: String(row.created_at),
    completedAt: row.completed_at == null ? null : String(row.completed_at)
  };
}

function rowToLine(row: Record<string, unknown>): InventoryReconciliationLine {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    tenantId: String(row.tenant_id),
    productId: String(row.product_id),
    locationId: String(row.location_id),
    expectedQuantity: Number(row.expected_quantity ?? 0),
    countedQuantity: Number(row.counted_quantity ?? 0),
    differenceQuantity: Number(row.difference_quantity ?? 0),
    status: String(row.status) as InventoryReconciliationLineStatus,
    movementId: row.movement_id == null ? null : String(row.movement_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1InventoryStore(db: D1Database): InventoryStore {
  return {
    async insertMovement(movement) {
      await db
        .prepare(
          `INSERT INTO inventory_stock_movements (${MOVEMENT_COLUMNS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          movement.id,
          movement.tenantId,
          movement.productId,
          movement.locationId,
          movement.movementType,
          movement.quantity,
          movement.onHandDelta,
          movement.reservedDelta,
          movement.sourceType,
          movement.sourceId,
          movement.reason,
          movement.createdById,
          movement.createdAt
        )
        .run();
    },

    async findMovementBySourceRef(tenantId, productId, locationId, movementType, sourceType, sourceId) {
      const row = await db
        .prepare(
          `SELECT ${MOVEMENT_COLUMNS}
           FROM inventory_stock_movements
           WHERE tenant_id = ? AND product_id = ? AND location_id = ? AND movement_type = ?
             AND source_type = ? AND source_id = ?`
        )
        .bind(tenantId, productId, locationId, movementType, sourceType, sourceId)
        .first<Record<string, unknown>>();
      return row ? rowToMovement(row) : null;
    },

    async listMovements(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];

      if (filter.productId) {
        clauses.push("product_id = ?");
        binds.push(filter.productId);
      }
      if (filter.locationId) {
        clauses.push("location_id = ?");
        binds.push(filter.locationId);
      }
      if (filter.movementType) {
        clauses.push("movement_type = ?");
        binds.push(filter.movementType);
      }
      if (filter.sourceType && filter.sourceId) {
        clauses.push("source_type = ? AND source_id = ?");
        binds.push(filter.sourceType, filter.sourceId);
      }

      const result = await db
        .prepare(
          `SELECT ${MOVEMENT_COLUMNS}
           FROM inventory_stock_movements
           WHERE ${clauses.join(" AND ")}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToMovement);
    },

    async getBalance(tenantId, productId, locationId) {
      const row = await db
        .prepare(
          `SELECT
             COALESCE(SUM(on_hand_delta), 0) AS on_hand,
             COALESCE(SUM(reserved_delta), 0) AS reserved
           FROM inventory_stock_movements
           WHERE tenant_id = ? AND product_id = ? AND location_id = ?`
        )
        .bind(tenantId, productId, locationId)
        .first<Record<string, unknown>>();

      const balance = emptyBalance(tenantId, productId, locationId);
      balance.onHand = Number(row?.on_hand ?? 0);
      balance.reserved = Number(row?.reserved ?? 0);
      balance.available = balance.onHand - balance.reserved;
      return balance;
    },

    async insertReconciliationDocument(document, lines) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO inventory_reconciliation_documents (${DOCUMENT_COLUMNS})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            document.id,
            document.tenantId,
            document.locationId,
            document.reference,
            document.reason,
            document.status,
            document.createdById,
            document.completedById,
            document.createdAt,
            document.completedAt
          ),
        ...lines.map((line) =>
          db
            .prepare(
              `INSERT INTO inventory_reconciliation_lines (${LINE_COLUMNS})
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              line.id,
              line.documentId,
              line.tenantId,
              line.productId,
              line.locationId,
              line.expectedQuantity,
              line.countedQuantity,
              line.differenceQuantity,
              line.status,
              line.movementId,
              line.createdAt,
              line.updatedAt
            )
        )
      ]);
    },

    async getReconciliationDocument(tenantId, documentId) {
      const row = await db
        .prepare(
          `SELECT ${DOCUMENT_COLUMNS}
           FROM inventory_reconciliation_documents
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(tenantId, documentId)
        .first<Record<string, unknown>>();
      if (!row) return null;

      const result = await db
        .prepare(
          `SELECT ${LINE_COLUMNS}
           FROM inventory_reconciliation_lines
           WHERE tenant_id = ? AND document_id = ?
           ORDER BY created_at ASC, id ASC`
        )
        .bind(tenantId, documentId)
        .all<Record<string, unknown>>();
      return {
        ...rowToDocument(row),
        lines: (result.results ?? []).map(rowToLine)
      } satisfies InventoryReconciliationDocumentWithLines;
    },

    async listReconciliationDocuments(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }

      const result = await db
        .prepare(
          `SELECT ${DOCUMENT_COLUMNS}
           FROM inventory_reconciliation_documents
           WHERE ${clauses.join(" AND ")}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToDocument);
    },

    async markReconciliationDocumentCompleted(tenantId, documentId, completedAt, completedById, lines) {
      await db.batch([
        db
          .prepare(
            `UPDATE inventory_reconciliation_documents
             SET status = 'completed', completed_at = ?, completed_by_id = ?
             WHERE tenant_id = ? AND id = ?`
          )
          .bind(completedAt, completedById, tenantId, documentId),
        ...lines.map((line) =>
          db
            .prepare(
              `UPDATE inventory_reconciliation_lines
               SET status = ?, movement_id = ?, updated_at = ?
               WHERE tenant_id = ? AND document_id = ? AND id = ?`
            )
            .bind(line.status, line.movementId, completedAt, tenantId, documentId, line.lineId)
        )
      ]);
    },

    async writeEvent(event) {
      await db
        .prepare(
          `INSERT INTO inventory_events (id, tenant_id, event_name, entity_type, entity_id, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          inventoryId("inv_evt"),
          event.tenantId,
          event.eventName,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload)
        )
        .run();
    }
  };
}
