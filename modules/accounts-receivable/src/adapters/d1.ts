import type { AccountsReceivableListFilter, AccountsReceivableStore } from "../ports";
import type { CustomerPayment, InvoiceSnapshot, PaymentApplication } from "../types";

const INVOICE_COLS =
  "id, tenant_id, customer_id, invoice_number, issued_at, due_date, total_cents, amount_paid_cents, amount_due_cents, status";
const PAYMENT_COLS =
  "id, tenant_id, customer_id, amount_cents, unapplied_cents, currency, payment_method, reference_number, provider_payment_id, deposit_account_id, received_at, idempotency_key, journal_entry_id, posted_at, created_at";
const APPLICATION_COLS = "id, tenant_id, payment_id, invoice_id, amount_cents, applied_at";

function toInvoice(row: Record<string, unknown>): InvoiceSnapshot {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    invoiceNumber: String(row.invoice_number),
    issuedAt: String(row.issued_at),
    dueDate: String(row.due_date),
    totalCents: Number(row.total_cents ?? 0),
    amountPaidCents: Number(row.amount_paid_cents ?? 0),
    amountDueCents: Number(row.amount_due_cents ?? 0),
    status: String(row.status ?? "open") as InvoiceSnapshot["status"]
  };
}

function toPayment(row: Record<string, unknown>): CustomerPayment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    amountCents: Number(row.amount_cents ?? 0),
    unappliedCents: Number(row.unapplied_cents ?? row.amount_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    paymentMethod: row.payment_method ? String(row.payment_method) : null,
    referenceNumber: row.reference_number ? String(row.reference_number) : null,
    providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : null,
    depositAccountId: row.deposit_account_id ? String(row.deposit_account_id) : null,
    paymentDate: String(row.received_at),
    idempotencyKey: String(row.idempotency_key),
    journalEntryId: row.journal_entry_id ? String(row.journal_entry_id) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null,
    createdAt: String(row.created_at)
  };
}

function toApplication(row: Record<string, unknown>): PaymentApplication {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    paymentId: String(row.payment_id),
    invoiceId: String(row.invoice_id),
    amountCents: Number(row.amount_cents ?? 0),
    appliedAt: String(row.applied_at)
  };
}

function invoiceClauses(tenantId: string, filter?: AccountsReceivableListFilter) {
  const clauses = ["tenant_id = ?"];
  const binds: unknown[] = [tenantId];
  if (filter?.customerId) {
    clauses.push("customer_id = ?");
    binds.push(filter.customerId);
  }
  return { clauses, binds };
}

export function createD1AccountsReceivableStore(db: D1Database): AccountsReceivableStore {
  return {
    async getInvoiceSnapshot(tenantId, invoiceId) {
      const row = await db
        .prepare(`SELECT ${INVOICE_COLS} FROM ar_invoice_snapshots WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, invoiceId)
        .first<Record<string, unknown>>();
      return row ? toInvoice(row) : null;
    },

    async listInvoiceSnapshots(tenantId, filter) {
      const { clauses, binds } = invoiceClauses(tenantId, filter);
      const result = await db
        .prepare(
          `SELECT ${INVOICE_COLS}
           FROM ar_invoice_snapshots
           WHERE ${clauses.join(" AND ")}
           ORDER BY issued_at ASC, invoice_number ASC`
        )
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toInvoice);
    },

    async listOpenInvoiceSnapshots(tenantId, filter) {
      const { clauses, binds } = invoiceClauses(tenantId, filter);
      clauses.push("amount_due_cents > 0", "status <> 'void'");
      const result = await db
        .prepare(
          `SELECT ${INVOICE_COLS}
           FROM ar_invoice_snapshots
           WHERE ${clauses.join(" AND ")}
           ORDER BY due_date ASC, invoice_number ASC`
        )
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toInvoice);
    },

    async upsertInvoiceSnapshot(invoice) {
      await db
        .prepare(
          `INSERT INTO ar_invoice_snapshots (${INVOICE_COLS}, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             tenant_id = excluded.tenant_id,
             customer_id = excluded.customer_id,
             invoice_number = excluded.invoice_number,
             issued_at = excluded.issued_at,
             due_date = excluded.due_date,
             total_cents = excluded.total_cents,
             amount_paid_cents = excluded.amount_paid_cents,
             amount_due_cents = excluded.amount_due_cents,
             status = excluded.status,
             updated_at = CURRENT_TIMESTAMP`
        )
        .bind(
          invoice.id,
          invoice.tenantId,
          invoice.customerId,
          invoice.invoiceNumber,
          invoice.issuedAt,
          invoice.dueDate,
          invoice.totalCents,
          invoice.amountPaidCents,
          invoice.amountDueCents,
          invoice.status
        )
        .run();
    },

    async getPayment(tenantId, paymentId) {
      const row = await db
        .prepare(`SELECT ${PAYMENT_COLS} FROM ar_customer_payments WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, paymentId)
        .first<Record<string, unknown>>();
      return row ? toPayment(row) : null;
    },

    async getPaymentByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await db
        .prepare(`SELECT ${PAYMENT_COLS} FROM ar_customer_payments WHERE tenant_id = ? AND idempotency_key = ?`)
        .bind(tenantId, idempotencyKey)
        .first<Record<string, unknown>>();
      return row ? toPayment(row) : null;
    },

    async listPayments(tenantId, filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [tenantId];
      if (filter?.customerId) {
        clauses.push("customer_id = ?");
        binds.push(filter.customerId);
      }
      const result = await db
        .prepare(
          `SELECT ${PAYMENT_COLS}
           FROM ar_customer_payments
           WHERE ${clauses.join(" AND ")}
           ORDER BY received_at ASC, created_at ASC`
        )
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toPayment);
    },

    async insertPayment(payment) {
      await db
        .prepare(
          `INSERT INTO ar_customer_payments (
            id,
            tenant_id,
            customer_id,
            amount_cents,
            unapplied_cents,
            currency,
            payment_method,
            reference_number,
            provider_payment_id,
            deposit_account_id,
            idempotency_key,
            journal_entry_id,
            posted_at,
            status,
            received_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?)`
        )
        .bind(
          payment.id,
          payment.tenantId,
          payment.customerId,
          payment.amountCents,
          payment.unappliedCents,
          payment.currency,
          payment.paymentMethod ?? "manual",
          payment.referenceNumber,
          payment.providerPaymentId,
          payment.depositAccountId,
          payment.idempotencyKey,
          payment.journalEntryId,
          payment.postedAt,
          payment.paymentDate,
          payment.createdAt,
          payment.createdAt
        )
        .run();
    },

    async updatePayment(payment) {
      await db
        .prepare(
          `UPDATE ar_customer_payments
           SET amount_cents = ?,
               unapplied_cents = ?,
               currency = ?,
               payment_method = ?,
               reference_number = ?,
               provider_payment_id = ?,
               deposit_account_id = ?,
               received_at = ?,
               journal_entry_id = ?,
               posted_at = ?,
               status = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          payment.amountCents,
          payment.unappliedCents,
          payment.currency,
          payment.paymentMethod ?? "manual",
          payment.referenceNumber,
          payment.providerPaymentId,
          payment.depositAccountId,
          payment.paymentDate,
          payment.journalEntryId,
          payment.postedAt,
          payment.unappliedCents === 0 ? "applied" : "recorded",
          payment.tenantId,
          payment.id
        )
        .run();
    },

    async listApplicationsByPaymentIds(tenantId, paymentIds) {
      if (paymentIds.length === 0) return [];
      const placeholders = paymentIds.map(() => "?").join(", ");
      const result = await db
        .prepare(
          `SELECT ${APPLICATION_COLS}
           FROM ar_payment_applications
           WHERE tenant_id = ? AND payment_id IN (${placeholders})
           ORDER BY applied_at ASC, created_at ASC`
        )
        .bind(tenantId, ...paymentIds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toApplication);
    },

    async insertApplications(applications) {
      if (applications.length === 0) return;
      await db.batch(
        applications.map((application) =>
          db
            .prepare(
              `INSERT INTO ar_payment_applications (
                id,
                tenant_id,
                customer_id,
                payment_id,
                invoice_id,
                amount_cents,
                applied_at,
                created_at
              ) VALUES (
                ?,
                ?,
                (SELECT customer_id FROM ar_customer_payments WHERE tenant_id = ? AND id = ?),
                ?,
                ?,
                ?,
                ?,
                CURRENT_TIMESTAMP
              )`
            )
            .bind(
              application.id,
              application.tenantId,
              application.tenantId,
              application.paymentId,
              application.paymentId,
              application.invoiceId,
              application.amountCents,
              application.appliedAt
            )
        )
      );
    }
  };
}
