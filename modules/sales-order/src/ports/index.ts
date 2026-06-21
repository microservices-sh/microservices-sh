import type {
  InventoryReservationRequest,
  InventoryReservationResult,
  InvoiceDraftRequest,
  InvoiceDraftResult,
  SalesOrder,
  SalesOrderEvent,
  SalesOrderFilter,
  SalesOrderLineItem,
  SalesOrderWithLineItems
} from "../types";

export interface SalesOrderStore {
  insertOrder(order: SalesOrder, lineItems: SalesOrderLineItem[]): Promise<void>;
  updateOrder(order: SalesOrder): Promise<void>;
  getOrder(tenantId: string, orderId: string): Promise<SalesOrderWithLineItems | null>;
  findOrderByExternalRef(tenantId: string, externalSource: string, externalId: string): Promise<SalesOrderWithLineItems | null>;
  listOrders(filter: SalesOrderFilter): Promise<SalesOrderWithLineItems[]>;
  writeEvent(event: SalesOrderEvent): Promise<void>;
}

export interface InventoryReservationPort {
  reserveSalesOrder(request: InventoryReservationRequest): Promise<InventoryReservationResult>;
}

export interface InvoiceDraftPort {
  createDraftFromSalesOrder(request: InvoiceDraftRequest): Promise<InvoiceDraftResult>;
}
