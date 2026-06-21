import type { InvoiceStore } from "../ports";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "../types";

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    number: row.number ? String(row.number) : null,
    series: String(row.series),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    status: String(row.status) as InvoiceStatus,
    currency: String(row.currency),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    amountPaidCents: Number(row.amount_paid_cents ?? 0),
    notes: row.notes ? String(row.notes) : null,
    issuedAt: row.issued_at ? String(row.issued_at) : null,
    dueAt: row.due_at ? String(row.due_at) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    voidedAt: row.voided_at ? String(row.voided_at) : null,
    paymentLinkId: row.payment_link_id ? String(row.payment_link_id) : null,
    paymentLinkUrl: row.payment_link_url ? String(row.payment_link_url) : null,
    paymentLinkProvider: row.payment_link_provider ? String(row.payment_link_provider) : null,
    paymentLinkCreatedAt: row.payment_link_created_at ? String(row.payment_link_created_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToLine(row: Record<string, unknown>): InvoiceLineItem {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 0),
    unitAmountCents: Number(row.unit_amount_cents ?? 0),
    taxRateBps: Number(row.tax_rate_bps ?? 0),
    amountCents: Number(row.amount_cents ?? 0)
  };
}

const COLS =
  "id, number, series, tenant_id, customer_id, status, currency, subtotal_cents, tax_cents, total_cents, amount_paid_cents, notes, issued_at, due_at, paid_at, voided_at, payment_link_id, payment_link_url, payment_link_provider, payment_link_created_at, created_at, updated_at";

export function createD1InvoiceStore(db: D1Database): InvoiceStore {
  return {
    async insert(invoice) {
      await db
        .prepare(`INSERT INTO invoices (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          invoice.id,
          invoice.number,
          invoice.series,
          invoice.tenantId,
          invoice.customerId,
          invoice.status,
          invoice.currency,
          invoice.subtotalCents,
          invoice.taxCents,
          invoice.totalCents,
          invoice.amountPaidCents,
          invoice.notes,
          invoice.issuedAt,
          invoice.dueAt,
          invoice.paidAt,
          invoice.voidedAt,
          invoice.paymentLinkId,
          invoice.paymentLinkUrl,
          invoice.paymentLinkProvider,
          invoice.paymentLinkCreatedAt,
          invoice.createdAt,
          invoice.updatedAt
        )
        .run();
    },

    async get(id) {
      const row = await db.prepare(`SELECT ${COLS} FROM invoices WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToInvoice(row) : null;
    },

    async update(invoice) {
      await db
        .prepare(
          `UPDATE invoices SET number = ?, status = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?,
             amount_paid_cents = ?, notes = ?, issued_at = ?, due_at = ?, paid_at = ?, voided_at = ?,
             payment_link_id = ?, payment_link_url = ?, payment_link_provider = ?, payment_link_created_at = ?,
             updated_at = ?
           WHERE id = ?`
        )
        .bind(
          invoice.number,
          invoice.status,
          invoice.subtotalCents,
          invoice.taxCents,
          invoice.totalCents,
          invoice.amountPaidCents,
          invoice.notes,
          invoice.issuedAt,
          invoice.dueAt,
          invoice.paidAt,
          invoice.voidedAt,
          invoice.paymentLinkId,
          invoice.paymentLinkUrl,
          invoice.paymentLinkProvider,
          invoice.paymentLinkCreatedAt,
          invoice.updatedAt,
          invoice.id
        )
        .run();
    },

    async list(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.customerId) {
        clauses.push("customer_id = ?");
        binds.push(filter.customerId);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(`SELECT ${COLS} FROM invoices WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToInvoice);
    },

    async listOverdue(nowIso, limit) {
      const result = await db
        .prepare(
          `SELECT ${COLS} FROM invoices WHERE status = 'open' AND due_at IS NOT NULL AND due_at <= ? ORDER BY due_at ASC LIMIT ?`
        )
        .bind(nowIso, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToInvoice);
    },

    async insertLineItem(item) {
      await db
        .prepare(
          "INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_amount_cents, tax_rate_bps, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(item.id, item.invoiceId, item.description, item.quantity, item.unitAmountCents, item.taxRateBps, item.amountCents)
        .run();
    },

    async listLineItems(invoiceId) {
      const result = await db
        .prepare(
          "SELECT id, invoice_id, description, quantity, unit_amount_cents, tax_rate_bps, amount_cents FROM invoice_line_items WHERE invoice_id = ? ORDER BY rowid ASC"
        )
        .bind(invoiceId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToLine);
    },

    async recordPaymentKey(invoiceId, key) {
      try {
        await db
          .prepare("INSERT INTO invoice_payments (id, invoice_id, idempotency_key) VALUES (?, ?, ?)")
          .bind("pay_" + crypto.randomUUID().slice(0, 16), invoiceId, key)
          .run();
        return true;
      } catch {
        // Unique constraint on idempotency_key: this payment was already applied.
        return false;
      }
    }
  };
}
