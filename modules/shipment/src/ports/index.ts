import type { ShipmentBatch, ShipmentEvent, ShipmentFilter, ShipmentItem } from "../types";

export interface ShipmentStore {
  insertShipment(batch: ShipmentBatch, items: ShipmentItem[]): Promise<void>;
  updateShipment(batch: ShipmentBatch): Promise<void>;
  getShipment(tenantId: string, shipmentId: string): Promise<ShipmentBatch | null>;
  findByExternalRef(tenantId: string, externalSource: string, externalId: string): Promise<ShipmentBatch | null>;
  findByCompletionRef(tenantId: string, completionRef: string): Promise<ShipmentBatch | null>;
  listShipments(filter: ShipmentFilter): Promise<ShipmentBatch[]>;
  listShipmentItems(tenantId: string, shipmentId: string): Promise<ShipmentItem[]>;
  writeEvent(event: ShipmentEvent): Promise<void>;
}

export interface ShipmentInventoryPort {
  deductShipment(input: {
    tenantId: string;
    shipmentId: string;
    completionRef: string;
    items: Array<{ productId: string; quantity: number; sourceType: string; sourceId: string }>;
  }): Promise<{ deductionRef: string }>;
}
