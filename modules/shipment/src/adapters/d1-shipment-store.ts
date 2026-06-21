import type { ShipmentStore } from "../ports";
import type { ShipmentBatch, ShipmentFilter, ShipmentItem, ShipmentSourceType, ShipmentStatus } from "../types";
import { shipmentId } from "../service";

const BATCH_COLS =
  "id, tenant_id, shipment_number, status, carrier, tracking_number, notes, external_id, external_source, completion_ref, inventory_deduction_ref, created_by_id, completed_at, created_at, updated_at";

function rowToBatch(row: Record<string, unknown>): ShipmentBatch {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    shipmentNumber: row.shipment_number == null ? null : String(row.shipment_number),
    status: String(row.status ?? "draft") as ShipmentStatus,
    carrier: row.carrier == null ? null : String(row.carrier),
    trackingNumber: row.tracking_number == null ? null : String(row.tracking_number),
    notes: row.notes == null ? null : String(row.notes),
    externalId: row.external_id == null ? null : String(row.external_id),
    externalSource: row.external_source == null ? null : String(row.external_source),
    completionRef: row.completion_ref == null ? null : String(row.completion_ref),
    inventoryDeductionRef: row.inventory_deduction_ref == null ? null : String(row.inventory_deduction_ref),
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    completedAt: row.completed_at == null ? null : String(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToItem(row: Record<string, unknown>): ShipmentItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    shipmentId: String(row.shipment_id),
    sourceType: String(row.source_type) as ShipmentSourceType,
    sourceId: String(row.source_id),
    productId: row.product_id == null ? null : String(row.product_id),
    sku: row.sku == null ? null : String(row.sku),
    description: String(row.description),
    quantity: Number(row.quantity)
  };
}

export function createD1ShipmentStore(db: D1Database): ShipmentStore {
  return {
    async insertShipment(batch, items) {
      await db
        .prepare(
          `INSERT INTO shipment_batches (${BATCH_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          batch.id,
          batch.tenantId,
          batch.shipmentNumber,
          batch.status,
          batch.carrier,
          batch.trackingNumber,
          batch.notes,
          batch.externalId,
          batch.externalSource,
          batch.completionRef,
          batch.inventoryDeductionRef,
          batch.createdById,
          batch.completedAt,
          batch.createdAt,
          batch.updatedAt
        )
        .run();
      for (const item of items) {
        await db
          .prepare(
            `INSERT INTO shipment_items (id, tenant_id, shipment_id, source_type, source_id, product_id, sku, description, quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(item.id, item.tenantId, item.shipmentId, item.sourceType, item.sourceId, item.productId, item.sku, item.description, item.quantity)
          .run();
      }
    },
    async updateShipment(batch) {
      await db
        .prepare(
          `UPDATE shipment_batches SET status = ?, carrier = ?, tracking_number = ?, notes = ?,
             completion_ref = ?, inventory_deduction_ref = ?, completed_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          batch.status,
          batch.carrier,
          batch.trackingNumber,
          batch.notes,
          batch.completionRef,
          batch.inventoryDeductionRef,
          batch.completedAt,
          batch.updatedAt,
          batch.tenantId,
          batch.id
        )
        .run();
    },
    async getShipment(tenantId, shipmentId) {
      const row = await db.prepare(`SELECT ${BATCH_COLS} FROM shipment_batches WHERE tenant_id = ? AND id = ?`).bind(tenantId, shipmentId).first<Record<string, unknown>>();
      return row ? rowToBatch(row) : null;
    },
    async findByExternalRef(tenantId, externalSource, externalId) {
      const row = await db
        .prepare(`SELECT ${BATCH_COLS} FROM shipment_batches WHERE tenant_id = ? AND external_source = ? AND external_id = ?`)
        .bind(tenantId, externalSource, externalId)
        .first<Record<string, unknown>>();
      return row ? rowToBatch(row) : null;
    },
    async findByCompletionRef(tenantId, completionRef) {
      const row = await db
        .prepare(`SELECT ${BATCH_COLS} FROM shipment_batches WHERE tenant_id = ? AND completion_ref = ?`)
        .bind(tenantId, completionRef)
        .first<Record<string, unknown>>();
      return row ? rowToBatch(row) : null;
    },
    async listShipments(filter: ShipmentFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (!filter.includeCancelled) clauses.push("status != 'cancelled'");
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter.sourceType || filter.sourceId) {
        const inner = ["tenant_id = ?", "shipment_id = shipment_batches.id"];
        binds.push(filter.tenantId);
        if (filter.sourceType) {
          inner.push("source_type = ?");
          binds.push(filter.sourceType);
        }
        if (filter.sourceId) {
          inner.push("source_id = ?");
          binds.push(filter.sourceId);
        }
        clauses.push(`EXISTS (SELECT 1 FROM shipment_items WHERE ${inner.join(" AND ")})`);
      }
      const result = await db
        .prepare(`SELECT ${BATCH_COLS} FROM shipment_batches WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToBatch);
    },
    async listShipmentItems(tenantId, shipmentId) {
      const result = await db
        .prepare(
          "SELECT id, tenant_id, shipment_id, source_type, source_id, product_id, sku, description, quantity FROM shipment_items WHERE tenant_id = ? AND shipment_id = ? ORDER BY rowid ASC"
        )
        .bind(tenantId, shipmentId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToItem);
    },
    async writeEvent(event) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(shipmentId("evt"), event.eventName, event.entityType, event.entityId, JSON.stringify(event))
        .run();
    }
  };
}
