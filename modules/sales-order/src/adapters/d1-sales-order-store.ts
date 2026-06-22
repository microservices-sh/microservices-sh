import type { SalesOrderStore } from "../ports";
import type {
  CustomerSnapshot,
  SalesOrder,
  SalesOrderFilter,
  SalesOrderLineItem,
  SalesOrderSendAttempt,
  SalesOrderStatus,
  SalesOrderWithLineItems
} from "../types";
import { salesOrderId } from "../service";

function parseCustomerSnapshot(value: unknown): CustomerSnapshot | null {
  if (value == null || value === "") return null;
  try {
    const parsed = JSON.parse(String(value)) as CustomerSnapshot;
    return {
      displayName: String(parsed.displayName ?? ""),
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      billingAddress: parsed.billingAddress ?? null,
      shippingAddress: parsed.shippingAddress ?? null,
      taxId: parsed.taxId ?? null
    };
  } catch {
    return null;
  }
}

function rowToOrder(row: Record<string, unknown>): SalesOrder {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    status: String(row.status ?? "draft") as SalesOrderStatus,
    currency: String(row.currency ?? "USD"),
    customerId: row.customer_id == null ? null : String(row.customer_id),
    customerSnapshot: parseCustomerSnapshot(row.customer_snapshot),
    externalId: row.external_id == null ? null : String(row.external_id),
    externalSource: row.external_source == null ? null : String(row.external_source),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    inventoryReservationId: row.inventory_reservation_id == null ? null : String(row.inventory_reservation_id),
    invoiceId: row.invoice_id == null ? null : String(row.invoice_id),
    notes: row.notes == null ? null : String(row.notes),
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    confirmedAt: row.confirmed_at == null ? null : String(row.confirmed_at),
    cancelledAt: row.cancelled_at == null ? null : String(row.cancelled_at),
    cancelReason: row.cancel_reason == null ? null : String(row.cancel_reason),
    invoicedAt: row.invoiced_at == null ? null : String(row.invoiced_at),
    lastSentAt: row.last_sent_at == null ? null : String(row.last_sent_at),
    lastSentToEmail: row.last_sent_to_email == null ? null : String(row.last_sent_to_email),
    lastSendStatus: row.last_send_status == null ? null : String(row.last_send_status),
    lastEmailDeliveryId: row.last_email_delivery_id == null ? null : String(row.last_email_delivery_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToLineItem(row: Record<string, unknown>): SalesOrderLineItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    orderId: String(row.order_id),
    productId: row.product_id == null ? null : String(row.product_id),
    sku: row.sku == null ? null : String(row.sku),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    quantity: Number(row.quantity ?? 1),
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    externalId: row.external_id == null ? null : String(row.external_id),
    externalSource: row.external_source == null ? null : String(row.external_source),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToSendAttempt(row: Record<string, unknown>): SalesOrderSendAttempt {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    orderId: String(row.order_id),
    recipientEmail: String(row.recipient_email),
    subject: String(row.subject),
    message: row.message == null ? null : String(row.message),
    provider: row.provider == null ? null : String(row.provider),
    deliveryId: row.delivery_id == null ? null : String(row.delivery_id),
    deliveryStatus: String(row.delivery_status ?? "queued"),
    idempotencyKey: row.idempotency_key == null ? null : String(row.idempotency_key),
    errorCode: row.error_code == null ? null : String(row.error_code),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    createdAt: String(row.created_at)
  };
}

const ORDER_COLS =
  "id, tenant_id, order_number, status, currency, customer_id, customer_snapshot, external_id, external_source, subtotal_cents, discount_cents, tax_cents, total_cents, inventory_reservation_id, invoice_id, notes, created_by_id, confirmed_at, cancelled_at, cancel_reason, invoiced_at, last_sent_at, last_sent_to_email, last_send_status, last_email_delivery_id, created_at, updated_at";

const LINE_COLS =
  "id, tenant_id, order_id, product_id, sku, name, description, quantity, unit_price_cents, subtotal_cents, discount_cents, tax_cents, total_cents, external_id, external_source, created_at, updated_at";

const SEND_ATTEMPT_COLS =
  "id, tenant_id, order_id, recipient_email, subject, message, provider, delivery_id, delivery_status, idempotency_key, error_code, error_message, created_by_id, created_at";

export function createD1SalesOrderStore(db: D1Database): SalesOrderStore {
  async function listLineItems(tenantId: string, orderId: string): Promise<SalesOrderLineItem[]> {
    const result = await db
      .prepare(`SELECT ${LINE_COLS} FROM sales_order_line_items WHERE tenant_id = ? AND order_id = ? ORDER BY rowid ASC`)
      .bind(tenantId, orderId)
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToLineItem);
  }

  async function withLineItems(order: SalesOrder): Promise<SalesOrderWithLineItems> {
    return { ...order, lineItems: await listLineItems(order.tenantId, order.id) };
  }

  return {
    async insertOrder(order, lineItems) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO sales_orders (${ORDER_COLS})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            order.id,
            order.tenantId,
            order.orderNumber,
            order.status,
            order.currency,
            order.customerId,
            order.customerSnapshot ? JSON.stringify(order.customerSnapshot) : null,
            order.externalId,
            order.externalSource,
            order.subtotalCents,
            order.discountCents,
            order.taxCents,
            order.totalCents,
            order.inventoryReservationId,
            order.invoiceId,
            order.notes,
            order.createdById,
            order.confirmedAt,
            order.cancelledAt,
            order.cancelReason,
            order.invoicedAt,
            order.lastSentAt,
            order.lastSentToEmail,
            order.lastSendStatus,
            order.lastEmailDeliveryId,
            order.createdAt,
            order.updatedAt
          ),
        ...lineItems.map((lineItem) =>
          db
            .prepare(
              `INSERT INTO sales_order_line_items (${LINE_COLS})
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              lineItem.id,
              lineItem.tenantId,
              lineItem.orderId,
              lineItem.productId,
              lineItem.sku,
              lineItem.name,
              lineItem.description,
              lineItem.quantity,
              lineItem.unitPriceCents,
              lineItem.subtotalCents,
              lineItem.discountCents,
              lineItem.taxCents,
              lineItem.totalCents,
              lineItem.externalId,
              lineItem.externalSource,
              lineItem.createdAt,
              lineItem.updatedAt
            )
        )
      ]);
    },

    async updateOrder(order) {
      await db
        .prepare(
          `UPDATE sales_orders
           SET order_number = ?, status = ?, currency = ?, customer_id = ?, customer_snapshot = ?,
             external_id = ?, external_source = ?, subtotal_cents = ?, discount_cents = ?, tax_cents = ?,
             total_cents = ?, inventory_reservation_id = ?, invoice_id = ?, notes = ?, confirmed_at = ?,
             cancelled_at = ?, cancel_reason = ?, invoiced_at = ?, last_sent_at = ?, last_sent_to_email = ?,
             last_send_status = ?, last_email_delivery_id = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          order.orderNumber,
          order.status,
          order.currency,
          order.customerId,
          order.customerSnapshot ? JSON.stringify(order.customerSnapshot) : null,
          order.externalId,
          order.externalSource,
          order.subtotalCents,
          order.discountCents,
          order.taxCents,
          order.totalCents,
          order.inventoryReservationId,
          order.invoiceId,
          order.notes,
          order.confirmedAt,
          order.cancelledAt,
          order.cancelReason,
          order.invoicedAt,
          order.lastSentAt,
          order.lastSentToEmail,
          order.lastSendStatus,
          order.lastEmailDeliveryId,
          order.updatedAt,
          order.tenantId,
          order.id
        )
        .run();
    },

    async getOrder(tenantId, orderId) {
      const row = await db
        .prepare(`SELECT ${ORDER_COLS} FROM sales_orders WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, orderId)
        .first<Record<string, unknown>>();
      return row ? withLineItems(rowToOrder(row)) : null;
    },

    async findOrderByExternalRef(tenantId, externalSource, externalId) {
      const row = await db
        .prepare(`SELECT ${ORDER_COLS} FROM sales_orders WHERE tenant_id = ? AND external_source = ? AND external_id = ?`)
        .bind(tenantId, externalSource, externalId)
        .first<Record<string, unknown>>();
      return row ? withLineItems(rowToOrder(row)) : null;
    },

    async listOrders(filter: SalesOrderFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter.customerId) {
        clauses.push("customer_id = ?");
        binds.push(filter.customerId);
      }
      if (filter.externalSource) {
        clauses.push("external_source = ?");
        binds.push(filter.externalSource);
      }

      const result = await db
        .prepare(`SELECT ${ORDER_COLS} FROM sales_orders WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return Promise.all((result.results ?? []).map((row) => withLineItems(rowToOrder(row))));
    },

    async insertSendAttempt(attempt) {
      await db
        .prepare(
          `INSERT INTO sales_order_send_attempts (${SEND_ATTEMPT_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          attempt.id,
          attempt.tenantId,
          attempt.orderId,
          attempt.recipientEmail,
          attempt.subject,
          attempt.message,
          attempt.provider,
          attempt.deliveryId,
          attempt.deliveryStatus,
          attempt.idempotencyKey,
          attempt.errorCode,
          attempt.errorMessage,
          attempt.createdById,
          attempt.createdAt
        )
        .run();
    },

    async findSendAttemptByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await db
        .prepare(`SELECT ${SEND_ATTEMPT_COLS} FROM sales_order_send_attempts WHERE tenant_id = ? AND idempotency_key = ?`)
        .bind(tenantId, idempotencyKey)
        .first<Record<string, unknown>>();
      return row ? rowToSendAttempt(row) : null;
    },

    async writeEvent(event) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(salesOrderId("evt"), event.eventName, event.entityType, event.entityId, JSON.stringify(event))
        .run();
    }
  };
}
