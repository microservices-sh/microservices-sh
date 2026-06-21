import type { RecurringDocumentsStore } from "../ports";
import type { RecurringDocumentLine, RecurringDocumentListFilter, RecurringDocumentTemplate, RecurringTemplateStatus } from "../types";

const TEMPLATE_COLS =
  "id, tenant_id, name, document_type, party_type, party_id, frequency, custom_days, status, start_date, end_date, next_run_date, last_run_date, payment_terms_days, max_occurrences, occurrences_generated, subtotal_cents, tax_basis_points, tax_cents, discount_cents, total_cents, currency, notes, terms, income_account_id, ar_account_id, expense_account_id, ap_account_id, auto_send, auto_approve, created_by_id, updated_by_id, created_at, updated_at";
const LINE_COLS = "id, tenant_id, template_id, product_id, expense_account_id, description, quantity, unit_price_cents, line_total_cents, sort_order";
const STATUSES: RecurringTemplateStatus[] = ["active", "paused", "completed", "cancelled"];

function toBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toLine(row: Record<string, unknown>): RecurringDocumentLine {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    templateId: String(row.template_id),
    productId: nullable(row.product_id),
    expenseAccountId: nullable(row.expense_account_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 0),
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    lineTotalCents: Number(row.line_total_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0)
  };
}

function toTemplate(row: Record<string, unknown>, lines: RecurringDocumentLine[]): RecurringDocumentTemplate {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    documentType: String(row.document_type) as RecurringDocumentTemplate["documentType"],
    partyType: String(row.party_type) as RecurringDocumentTemplate["partyType"],
    partyId: String(row.party_id),
    frequency: String(row.frequency) as RecurringDocumentTemplate["frequency"],
    customDays: row.custom_days == null ? null : Number(row.custom_days),
    status: String(row.status) as RecurringDocumentTemplate["status"],
    startDate: String(row.start_date),
    endDate: nullable(row.end_date),
    nextRunDate: nullable(row.next_run_date),
    lastRunDate: nullable(row.last_run_date),
    paymentTermsDays: Number(row.payment_terms_days ?? 30),
    maxOccurrences: row.max_occurrences == null ? null : Number(row.max_occurrences),
    occurrencesGenerated: Number(row.occurrences_generated ?? 0),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxBasisPoints: Number(row.tax_basis_points ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    currency: String(row.currency),
    notes: nullable(row.notes),
    terms: nullable(row.terms),
    incomeAccountId: nullable(row.income_account_id),
    arAccountId: nullable(row.ar_account_id),
    expenseAccountId: nullable(row.expense_account_id),
    apAccountId: nullable(row.ap_account_id),
    autoSend: toBool(row.auto_send),
    autoApprove: toBool(row.auto_approve),
    createdById: nullable(row.created_by_id),
    updatedById: nullable(row.updated_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines
  };
}

async function getLines(db: D1Database, tenantId: string, templateId: string): Promise<RecurringDocumentLine[]> {
  const result = await db
    .prepare(`SELECT ${LINE_COLS} FROM recurring_document_lines WHERE tenant_id = ? AND template_id = ? ORDER BY sort_order ASC`)
    .bind(tenantId, templateId)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(toLine);
}

async function hydrate(db: D1Database, row: Record<string, unknown> | null): Promise<RecurringDocumentTemplate | null> {
  if (!row) return null;
  return toTemplate(row, await getLines(db, String(row.tenant_id), String(row.id)));
}

async function insertLines(db: D1Database, lines: RecurringDocumentLine[]) {
  if (!lines.length) return;
  await db.batch(
    lines.map((line) =>
      db
        .prepare(`INSERT INTO recurring_document_lines (${LINE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(line.id, line.tenantId, line.templateId, line.productId, line.expenseAccountId, line.description, line.quantity, line.unitPriceCents, line.lineTotalCents, line.sortOrder)
    )
  );
}

function filterSql(tenantId: string, filter?: RecurringDocumentListFilter) {
  const clauses = ["tenant_id = ?"];
  const binds: unknown[] = [tenantId];
  if (filter?.documentType) {
    clauses.push("document_type = ?");
    binds.push(filter.documentType);
  }
  if (filter?.partyId) {
    clauses.push("party_id = ?");
    binds.push(filter.partyId);
  }
  if (filter?.status) {
    clauses.push("status = ?");
    binds.push(filter.status);
  }
  if (filter?.dueBefore) {
    clauses.push("next_run_date IS NOT NULL AND next_run_date <= ?");
    binds.push(filter.dueBefore);
  }
  return { where: clauses.join(" AND "), binds };
}

export function createD1RecurringDocumentsStore(db: D1Database): RecurringDocumentsStore {
  return {
    async getTemplate(tenantId, templateId) {
      const row = await db.prepare(`SELECT ${TEMPLATE_COLS} FROM recurring_document_templates WHERE tenant_id = ? AND id = ?`).bind(tenantId, templateId).first<Record<string, unknown>>();
      return hydrate(db, row);
    },

    async insertTemplate(template) {
      await db
        .prepare(`INSERT INTO recurring_document_templates (${TEMPLATE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          template.id,
          template.tenantId,
          template.name,
          template.documentType,
          template.partyType,
          template.partyId,
          template.frequency,
          template.customDays,
          template.status,
          template.startDate,
          template.endDate,
          template.nextRunDate,
          template.lastRunDate,
          template.paymentTermsDays,
          template.maxOccurrences,
          template.occurrencesGenerated,
          template.subtotalCents,
          template.taxBasisPoints,
          template.taxCents,
          template.discountCents,
          template.totalCents,
          template.currency,
          template.notes,
          template.terms,
          template.incomeAccountId,
          template.arAccountId,
          template.expenseAccountId,
          template.apAccountId,
          template.autoSend ? 1 : 0,
          template.autoApprove ? 1 : 0,
          template.createdById,
          template.updatedById,
          template.createdAt,
          template.updatedAt
        )
        .run();
      await insertLines(db, template.lines);
    },

    async updateTemplate(template) {
      await db
        .prepare(
          `UPDATE recurring_document_templates SET name = ?, party_id = ?, frequency = ?, custom_days = ?, status = ?, start_date = ?, end_date = ?, next_run_date = ?, last_run_date = ?, payment_terms_days = ?, max_occurrences = ?, occurrences_generated = ?, subtotal_cents = ?, tax_basis_points = ?, tax_cents = ?, discount_cents = ?, total_cents = ?, currency = ?, notes = ?, terms = ?, income_account_id = ?, ar_account_id = ?, expense_account_id = ?, ap_account_id = ?, auto_send = ?, auto_approve = ?, updated_by_id = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          template.name,
          template.partyId,
          template.frequency,
          template.customDays,
          template.status,
          template.startDate,
          template.endDate,
          template.nextRunDate,
          template.lastRunDate,
          template.paymentTermsDays,
          template.maxOccurrences,
          template.occurrencesGenerated,
          template.subtotalCents,
          template.taxBasisPoints,
          template.taxCents,
          template.discountCents,
          template.totalCents,
          template.currency,
          template.notes,
          template.terms,
          template.incomeAccountId,
          template.arAccountId,
          template.expenseAccountId,
          template.apAccountId,
          template.autoSend ? 1 : 0,
          template.autoApprove ? 1 : 0,
          template.updatedById,
          template.updatedAt,
          template.tenantId,
          template.id
        )
        .run();
      await db.prepare("DELETE FROM recurring_document_lines WHERE tenant_id = ? AND template_id = ?").bind(template.tenantId, template.id).run();
      await insertLines(db, template.lines);
    },

    async listTemplates(tenantId, filter) {
      const { where, binds } = filterSql(tenantId, filter);
      const count = await db.prepare(`SELECT COUNT(*) AS total FROM recurring_document_templates WHERE ${where}`).bind(...binds).first<{ total: number }>();
      const limit = filter?.limit ?? 100;
      const offset = filter?.offset ?? 0;
      const result = await db.prepare(`SELECT ${TEMPLATE_COLS} FROM recurring_document_templates WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all<Record<string, unknown>>();
      const templates = [];
      for (const row of result.results ?? []) {
        const template = await hydrate(db, row);
        if (template) templates.push(template);
      }
      return { templates, total: Number(count?.total ?? 0) };
    },

    async listDueTemplates(tenantId, asOf, limit = 100) {
      const result = await db
        .prepare(`SELECT ${TEMPLATE_COLS} FROM recurring_document_templates WHERE tenant_id = ? AND status = 'active' AND next_run_date IS NOT NULL AND next_run_date <= ? ORDER BY next_run_date ASC LIMIT ?`)
        .bind(tenantId, asOf, limit)
        .all<Record<string, unknown>>();
      const templates = [];
      for (const row of result.results ?? []) {
        const template = await hydrate(db, row);
        if (template) templates.push(template);
      }
      return templates;
    },

    async countTemplatesByStatus(tenantId) {
      const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<RecurringTemplateStatus, number>;
      const result = await db.prepare("SELECT status, COUNT(*) AS total FROM recurring_document_templates WHERE tenant_id = ? GROUP BY status").bind(tenantId).all<{ status: RecurringTemplateStatus; total: number }>();
      for (const row of result.results ?? []) counts[row.status] = Number(row.total ?? 0);
      return counts;
    }
  };
}
