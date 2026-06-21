import type { EstimateQuoteStore } from "../ports";
import type { EstimateQuote, EstimateQuoteLine, EstimateQuoteListFilter, EstimateQuoteStatus } from "../types";

const QUOTE_COLS =
  "id, tenant_id, quote_number, client_id, status, issue_date, expiry_date, sent_at, viewed_at, accepted_at, declined_at, expired_at, converted_at, voided_at, subtotal_cents, tax_basis_points, tax_cents, discount_cents, total_cents, currency, notes, terms, converted_to_invoice_id, pdf_key, created_by_id, updated_by_id, created_at, updated_at";
const LINE_COLS = "id, tenant_id, quote_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order";
const STATUSES: EstimateQuoteStatus[] = ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted", "void"];

function toNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toLine(row: Record<string, unknown>): EstimateQuoteLine {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    quoteId: String(row.quote_id),
    productId: toNullableString(row.product_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 0),
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    lineTotalCents: Number(row.line_total_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0)
  };
}

function toQuote(row: Record<string, unknown>, lines: EstimateQuoteLine[]): EstimateQuote {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    quoteNumber: String(row.quote_number),
    clientId: String(row.client_id),
    status: String(row.status) as EstimateQuoteStatus,
    issueDate: String(row.issue_date),
    expiryDate: toNullableString(row.expiry_date),
    sentAt: toNullableString(row.sent_at),
    viewedAt: toNullableString(row.viewed_at),
    acceptedAt: toNullableString(row.accepted_at),
    declinedAt: toNullableString(row.declined_at),
    expiredAt: toNullableString(row.expired_at),
    convertedAt: toNullableString(row.converted_at),
    voidedAt: toNullableString(row.voided_at),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxBasisPoints: Number(row.tax_basis_points ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    currency: String(row.currency),
    notes: toNullableString(row.notes),
    terms: toNullableString(row.terms),
    convertedToInvoiceId: toNullableString(row.converted_to_invoice_id),
    pdfKey: toNullableString(row.pdf_key),
    createdById: toNullableString(row.created_by_id),
    updatedById: toNullableString(row.updated_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines
  };
}

async function getLines(db: D1Database, tenantId: string, quoteId: string): Promise<EstimateQuoteLine[]> {
  const result = await db
    .prepare(`SELECT ${LINE_COLS} FROM estimate_quote_lines WHERE tenant_id = ? AND quote_id = ? ORDER BY sort_order ASC`)
    .bind(tenantId, quoteId)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(toLine);
}

async function insertLines(db: D1Database, lines: EstimateQuoteLine[]): Promise<void> {
  if (!lines.length) return;
  await db.batch(
    lines.map((line) =>
      db
        .prepare(`INSERT INTO estimate_quote_lines (${LINE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          line.id,
          line.tenantId,
          line.quoteId,
          line.productId,
          line.description,
          line.quantity,
          line.unitPriceCents,
          line.lineTotalCents,
          line.sortOrder
        )
    )
  );
}

async function hydrate(db: D1Database, row: Record<string, unknown> | null): Promise<EstimateQuote | null> {
  if (!row) return null;
  return toQuote(row, await getLines(db, String(row.tenant_id), String(row.id)));
}

function appendFilters(tenantId: string, filter?: EstimateQuoteListFilter) {
  const clauses = ["tenant_id = ?"];
  const binds: unknown[] = [tenantId];
  if (filter?.status) {
    clauses.push("status = ?");
    binds.push(filter.status);
  }
  if (filter?.clientId) {
    clauses.push("client_id = ?");
    binds.push(filter.clientId);
  }
  if (filter?.numberSearch) {
    clauses.push("quote_number LIKE ?");
    binds.push(`%${filter.numberSearch}%`);
  }
  if (filter?.issueDateFrom) {
    clauses.push("issue_date >= ?");
    binds.push(filter.issueDateFrom);
  }
  if (filter?.issueDateTo) {
    clauses.push("issue_date <= ?");
    binds.push(filter.issueDateTo);
  }
  return { where: clauses.join(" AND "), binds };
}

export function createD1EstimateQuoteStore(db: D1Database): EstimateQuoteStore {
  return {
    async getQuote(tenantId, quoteId) {
      const row = await db.prepare(`SELECT ${QUOTE_COLS} FROM estimate_quotes WHERE tenant_id = ? AND id = ?`).bind(tenantId, quoteId).first<Record<string, unknown>>();
      return hydrate(db, row);
    },

    async getQuoteByNumber(tenantId, quoteNumber) {
      const row = await db.prepare(`SELECT ${QUOTE_COLS} FROM estimate_quotes WHERE tenant_id = ? AND quote_number = ?`).bind(tenantId, quoteNumber).first<Record<string, unknown>>();
      return hydrate(db, row);
    },

    async getLatestQuoteNumber(tenantId, prefix) {
      const row = await db
        .prepare("SELECT quote_number FROM estimate_quotes WHERE tenant_id = ? AND quote_number LIKE ? ORDER BY CAST(SUBSTR(quote_number, ?) AS INTEGER) DESC LIMIT 1")
        .bind(tenantId, `${prefix}-%`, prefix.length + 2)
        .first<{ quote_number: string }>();
      return row?.quote_number ?? null;
    },

    async insertQuote(quote) {
      await db
        .prepare(`INSERT INTO estimate_quotes (${QUOTE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          quote.id,
          quote.tenantId,
          quote.quoteNumber,
          quote.clientId,
          quote.status,
          quote.issueDate,
          quote.expiryDate,
          quote.sentAt,
          quote.viewedAt,
          quote.acceptedAt,
          quote.declinedAt,
          quote.expiredAt,
          quote.convertedAt,
          quote.voidedAt,
          quote.subtotalCents,
          quote.taxBasisPoints,
          quote.taxCents,
          quote.discountCents,
          quote.totalCents,
          quote.currency,
          quote.notes,
          quote.terms,
          quote.convertedToInvoiceId,
          quote.pdfKey,
          quote.createdById,
          quote.updatedById,
          quote.createdAt,
          quote.updatedAt
        )
        .run();
      await insertLines(db, quote.lines);
    },

    async updateQuote(quote) {
      await db
        .prepare(
          `UPDATE estimate_quotes SET client_id = ?, status = ?, issue_date = ?, expiry_date = ?, sent_at = ?, viewed_at = ?, accepted_at = ?, declined_at = ?, expired_at = ?, converted_at = ?, voided_at = ?, subtotal_cents = ?, tax_basis_points = ?, tax_cents = ?, discount_cents = ?, total_cents = ?, currency = ?, notes = ?, terms = ?, converted_to_invoice_id = ?, pdf_key = ?, updated_by_id = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          quote.clientId,
          quote.status,
          quote.issueDate,
          quote.expiryDate,
          quote.sentAt,
          quote.viewedAt,
          quote.acceptedAt,
          quote.declinedAt,
          quote.expiredAt,
          quote.convertedAt,
          quote.voidedAt,
          quote.subtotalCents,
          quote.taxBasisPoints,
          quote.taxCents,
          quote.discountCents,
          quote.totalCents,
          quote.currency,
          quote.notes,
          quote.terms,
          quote.convertedToInvoiceId,
          quote.pdfKey,
          quote.updatedById,
          quote.updatedAt,
          quote.tenantId,
          quote.id
        )
        .run();
      await db.prepare("DELETE FROM estimate_quote_lines WHERE tenant_id = ? AND quote_id = ?").bind(quote.tenantId, quote.id).run();
      await insertLines(db, quote.lines);
    },

    async listQuotes(tenantId, filter) {
      const { where, binds } = appendFilters(tenantId, filter);
      const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM estimate_quotes WHERE ${where}`).bind(...binds).first<{ total: number }>();
      const limit = filter?.limit ?? 100;
      const offset = filter?.offset ?? 0;
      const result = await db
        .prepare(`SELECT ${QUOTE_COLS} FROM estimate_quotes WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...binds, limit, offset)
        .all<Record<string, unknown>>();
      const quotes = [];
      for (const row of result.results ?? []) {
        const quote = await hydrate(db, row);
        if (quote) quotes.push(quote);
      }
      return { quotes, total: Number(countRow?.total ?? 0) };
    },

    async listExpirableQuotes(tenantId, asOf, limit = 100) {
      const result = await db
        .prepare(`SELECT ${QUOTE_COLS} FROM estimate_quotes WHERE tenant_id = ? AND status IN ('sent', 'viewed') AND expiry_date IS NOT NULL AND expiry_date < ? ORDER BY expiry_date ASC LIMIT ?`)
        .bind(tenantId, asOf, limit)
        .all<Record<string, unknown>>();
      const quotes = [];
      for (const row of result.results ?? []) {
        const quote = await hydrate(db, row);
        if (quote) quotes.push(quote);
      }
      return quotes;
    },

    async countQuotesByStatus(tenantId) {
      const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<EstimateQuoteStatus, number>;
      const result = await db
        .prepare("SELECT status, COUNT(*) AS total FROM estimate_quotes WHERE tenant_id = ? GROUP BY status")
        .bind(tenantId)
        .all<{ status: EstimateQuoteStatus; total: number }>();
      for (const row of result.results ?? []) counts[row.status] = Number(row.total ?? 0);
      return counts;
    }
  };
}
