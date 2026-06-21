import type { InventoryStore } from "../ports";
import { inventoryId } from "../service";
import type { StockBalance, StockMovement, StockMovementFilter, StockMovementType } from "../types";

const MOVEMENT_COLUMNS =
  "id, tenant_id, product_id, location_id, movement_type, quantity, on_hand_delta, reserved_delta, source_type, source_id, reason, created_by_id, created_at";

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
