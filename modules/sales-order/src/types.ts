export type SalesOrderStatus = "draft" | "confirmed" | "cancelled" | "invoiced";

export interface SalesOrderConfig {
  enabled: boolean;
  defaultCurrency: string;
}

export interface Actor {
  id: string;
  email?: string;
  permissions?: string[];
}

export interface CustomerSnapshot {
  displayName: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  taxId: string | null;
}

export interface SalesOrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export interface SalesOrder {
  id: string;
  tenantId: string;
  orderNumber: string | null;
  status: SalesOrderStatus;
  currency: string;
  customerId: string | null;
  customerSnapshot: CustomerSnapshot | null;
  externalId: string | null;
  externalSource: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  inventoryReservationId: string | null;
  invoiceId: string | null;
  notes: string | null;
  createdById: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  invoicedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderLineItem {
  id: string;
  tenantId: string;
  orderId: string;
  productId: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  externalId: string | null;
  externalSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderWithLineItems extends SalesOrder {
  lineItems: SalesOrderLineItem[];
}

export interface SalesOrderFilter {
  tenantId: string;
  status?: SalesOrderStatus;
  customerId?: string;
  externalSource?: string;
  limit?: number;
}

export interface SalesOrderEvent {
  eventName:
    | "sales-order.order_created"
    | "sales-order.order_confirmed"
    | "sales-order.order_cancelled"
    | "sales-order.order_invoiced";
  entityType: "sales-order";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export interface InventoryReservationRequest {
  order: SalesOrderWithLineItems;
}

export interface InventoryReservationResult {
  reservationId?: string | null;
}

export interface InvoiceDraftRequest {
  order: SalesOrderWithLineItems;
}

export interface InvoiceDraftResult {
  invoiceId: string;
  invoiceNumber?: string | null;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
