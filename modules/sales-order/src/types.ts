export type SalesOrderStatus = "draft" | "confirmed" | "cancelled" | "invoiced";
export type SalesOrderBulkTransitionAction = "confirm" | "cancel";

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
  lastSentAt: string | null;
  lastSentToEmail: string | null;
  lastSendStatus: string | null;
  lastEmailDeliveryId: string | null;
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
    | "sales-order.order_invoiced"
    | "sales-order.order_sent"
    | "sales-order.order_send_failed";
  entityType: "sales-order";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export interface SalesOrderSendAttempt {
  id: string;
  tenantId: string;
  orderId: string;
  recipientEmail: string;
  subject: string;
  message: string | null;
  provider: string | null;
  deliveryId: string | null;
  deliveryStatus: string;
  idempotencyKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface SalesOrderBulkTransitionSuccess {
  orderId: string;
  ok: true;
  status: number;
  idempotent: boolean;
  order: SalesOrderWithLineItems;
}

export interface SalesOrderBulkTransitionFailure {
  orderId: string;
  ok: false;
  status: number;
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

export type SalesOrderBulkTransitionItem = SalesOrderBulkTransitionSuccess | SalesOrderBulkTransitionFailure;

export interface SalesOrderBulkTransitionSummary {
  action: SalesOrderBulkTransitionAction;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  items: SalesOrderBulkTransitionItem[];
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

export interface SalesOrderDeliveryRequest {
  order: SalesOrderWithLineItems;
  toEmail: string;
  subject: string;
  message: string | null;
  idempotencyKey?: string | null;
}

export interface SalesOrderDeliveryResult {
  provider?: string | null;
  deliveryId?: string | null;
  status?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
