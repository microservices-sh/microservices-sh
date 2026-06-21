export { manifest } from "./manifest";
export {
  cancelShipmentSchema,
  completeShipmentSchema,
  getShipmentSchema,
  shipmentConfigSchema,
  shipmentFilterSchema,
  shipmentInputSchema,
  shipmentItemInputSchema,
  shipmentRecordSchema,
  shipmentSourceTypeSchema,
  shipmentStatusSchema
} from "./schemas";
export { defaultShipmentHooks } from "./hooks";
export { shipmentEvents } from "./events";
export { shipmentPermissions } from "./permissions";
export { shipmentResources } from "./resources";
export { createMemoryShipmentStore } from "./adapters/memory-shipment-store";
export { createD1ShipmentStore } from "./adapters/d1-shipment-store";
export { cancelShipment } from "./use-cases/cancel-shipment";
export { completeShipment } from "./use-cases/complete-shipment";
export { createShipment } from "./use-cases/create-shipment";
export { getShipment } from "./use-cases/get-shipment";
export { listShipments } from "./use-cases/list-shipments";
export type { ShipmentInventoryPort, ShipmentStore } from "./ports";
export type {
  Actor,
  ModuleResult,
  ShipmentBatch,
  ShipmentConfig,
  ShipmentEvent,
  ShipmentFilter,
  ShipmentItem,
  ShipmentSourceType,
  ShipmentStatus,
  ShipmentWithItems
} from "./types";

export const shipmentModule = {
  id: "shipment",
  version: "0.1.0"
} as const;
