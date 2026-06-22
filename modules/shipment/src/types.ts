export type ShipmentStatus = "draft" | "processing" | "completed" | "cancelled";
export type ShipmentSourceType = "sales-order" | "invoice" | "manual";

export interface Actor {
  id: string;
  type?: "user" | "system" | "agent";
}

export interface ShipmentConfig {
  enabled: boolean;
}

export interface ShipmentBatch {
  id: string;
  tenantId: string;
  shipmentNumber: string | null;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  externalId: string | null;
  externalSource: string | null;
  completionRef: string | null;
  inventoryDeductionRef: string | null;
  createdById: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentItem {
  id: string;
  tenantId: string;
  shipmentId: string;
  sourceType: ShipmentSourceType;
  sourceId: string;
  productId: string | null;
  sku: string | null;
  description: string;
  quantity: number;
}

export interface ShipmentStatusTransition {
  id: string;
  tenantId: string;
  shipmentId: string;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  reason: string | null;
  actorId: string | null;
  changedAt: string;
}

export interface ShipmentWithItems extends ShipmentBatch {
  items: ShipmentItem[];
}

export interface ShipmentFilter {
  tenantId: string;
  status?: ShipmentStatus;
  sourceType?: ShipmentSourceType;
  sourceId?: string;
  includeCancelled?: boolean;
  limit?: number;
}

export interface ShipmentStatusTransitionFilter {
  tenantId: string;
  shipmentId: string;
  limit?: number;
}

export interface ShipmentEvent {
  eventName: string;
  tenantId: string;
  entityType: "shipment";
  entityId: string;
  payload: Record<string, unknown>;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
