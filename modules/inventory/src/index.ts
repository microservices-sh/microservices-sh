export { createD1InventoryStore } from "./adapters/d1-inventory-store";
export { createMemoryInventoryStore } from "./adapters/memory-inventory-store";
export { defaultConfig } from "./config";
export { inventoryEvents } from "./events";
export { defaultInventoryHooks } from "./hooks";
export { manifest } from "./manifest";
export { inventoryPermissions } from "./permissions";
export { inventoryResources } from "./resources";
export {
  completeReconciliationDocumentInputSchema,
  createReconciliationDocumentInputSchema,
  deductStockInputSchema,
  inventoryConfigSchema,
  lowStockAlertInputSchema,
  lowStockProductInputSchema,
  optionalSourceRefSchema,
  positiveStockQuantitySchema,
  reconciliationDocumentFilterSchema,
  reconciliationDocumentLineInputSchema,
  reconciliationDocumentStatusSchema,
  reconciliationLineStatusSchema,
  reconcileStockInputSchema,
  releaseReservationInputSchema,
  requiredSourceRefSchema,
  reserveStockInputSchema,
  stockBalanceLookupSchema,
  stockInInputSchema,
  stockMovementFilterSchema,
  stockMovementRecordSchema,
  stockMovementTypeSchema,
  stockQuantitySchema
} from "./schemas";
export { completeReconciliationDocument } from "./use-cases/complete-reconciliation-document";
export { createReconciliationDocument } from "./use-cases/create-reconciliation-document";
export { deductStock } from "./use-cases/deduct-stock";
export { getStockBalance } from "./use-cases/get-stock-balance";
export { listLowStockAlerts } from "./use-cases/list-low-stock-alerts";
export { listReconciliationDocuments } from "./use-cases/list-reconciliation-documents";
export { listStockMovements } from "./use-cases/list-stock-movements";
export { reconcileStock } from "./use-cases/reconcile-stock";
export { releaseReservation } from "./use-cases/release-reservation";
export { reserveStock } from "./use-cases/reserve-stock";
export { stockIn } from "./use-cases/stock-in";
export type { InventoryHooks } from "./hooks";
export type { InventoryProductReader, InventoryStore } from "./ports";
export type {
  Actor,
  InventoryConfig,
  InventoryEvent,
  InventoryEventName,
  InventoryLowStockAlert,
  InventoryLowStockProductInput,
  InventoryProductRef,
  InventoryReconciliationDocument,
  InventoryReconciliationDocumentFilter,
  InventoryReconciliationDocumentStatus,
  InventoryReconciliationDocumentWithLines,
  InventoryReconciliationLine,
  InventoryReconciliationLineStatus,
  ModuleResult,
  StockBalance,
  StockMovement,
  StockMovementFilter,
  StockMovementType,
  StockSourceRef
} from "./types";

export const inventoryModule = {
  id: "inventory",
  version: "0.1.0"
} as const;
