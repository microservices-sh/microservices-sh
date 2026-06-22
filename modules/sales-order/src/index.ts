export { manifest } from "./manifest";
export {
  cancelOrderInputSchema,
  createDraftOrderInputSchema,
  customerSnapshotSchema,
  sendSalesOrderInputSchema,
  salesOrderConfigSchema,
  salesOrderFilterSchema,
  salesOrderIdentitySchema,
  salesOrderLineInputSchema,
  salesOrderRecordSchema,
  salesOrderStatusSchema
} from "./schemas";
export { defaultSalesOrderHooks } from "./hooks";
export { salesOrderEvents } from "./events";
export { salesOrderPermissions } from "./permissions";
export { salesOrderResources } from "./resources";
export { createD1SalesOrderStore } from "./adapters/d1-sales-order-store";
export { createMemorySalesOrderStore } from "./adapters/memory-sales-order-store";
export { cancelOrder } from "./use-cases/cancel-order";
export { confirmOrder } from "./use-cases/confirm-order";
export { createDraftOrder } from "./use-cases/create-draft-order";
export { getOrder } from "./use-cases/get-order";
export { listOrders } from "./use-cases/list-orders";
export { markOrderInvoiced } from "./use-cases/mark-order-invoiced";
export { sendSalesOrder } from "./use-cases/send-sales-order";
export type { InventoryReservationPort, InvoiceDraftPort, SalesOrderDeliveryPort, SalesOrderStore } from "./ports";
export type {
  Actor,
  CustomerSnapshot,
  InventoryReservationRequest,
  InventoryReservationResult,
  InvoiceDraftRequest,
  InvoiceDraftResult,
  ModuleResult,
  SalesOrder,
  SalesOrderConfig,
  SalesOrderDeliveryRequest,
  SalesOrderDeliveryResult,
  SalesOrderEvent,
  SalesOrderFilter,
  SalesOrderLineItem,
  SalesOrderSendAttempt,
  SalesOrderStatus,
  SalesOrderTotals,
  SalesOrderWithLineItems
} from "./types";

export const salesOrderModule = {
  id: "sales-order",
  version: "0.1.0"
} as const;
