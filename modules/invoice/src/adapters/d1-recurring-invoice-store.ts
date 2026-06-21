import type { RecurringInvoiceStore } from "../ports";
import type {
  RecurringInvoiceFrequency,
  RecurringInvoiceStatus,
  RecurringInvoiceTemplate,
  RecurringInvoiceTemplateFilter,
  RecurringInvoiceTemplateLineItem,
  RecurringInvoiceTemplateWithLineItems
} from "../types";

const TEMPLATE_COLS =
  "id, tenant_id, customer_id, name, series, currency, frequency, custom_days, status, start_at, end_at, next_invoice_at, last_invoice_at, payment_terms_days, max_occurrences, invoices_generated, auto_issue, notes, subtotal_cents, tax_cents, total_cents, created_at, updated_at";
const LINE_COLS =
  "id, template_id, description, quantity, unit_amount_cents, tax_rate_bps, amount_cents, sort_order, created_at, updated_at";

function nullable(row: Record<string, unknown>, key: string): string | null {
  return row[key] == null ? null : String(row[key]);
}

function rowToTemplate(row: Record<string, unknown>): RecurringInvoiceTemplate {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    name: String(row.name),
    series: String(row.series),
    currency: String(row.currency),
    frequency: String(row.frequency) as RecurringInvoiceFrequency,
    customDays: row.custom_days == null ? null : Number(row.custom_days),
    status: String(row.status) as RecurringInvoiceStatus,
    startAt: String(row.start_at),
    endAt: nullable(row, "end_at"),
    nextInvoiceAt: nullable(row, "next_invoice_at"),
    lastInvoiceAt: nullable(row, "last_invoice_at"),
    paymentTermsDays: Number(row.payment_terms_days ?? 14),
    maxOccurrences: row.max_occurrences == null ? null : Number(row.max_occurrences),
    invoicesGenerated: Number(row.invoices_generated ?? 0),
    autoIssue: Number(row.auto_issue ?? 0) === 1,
    notes: nullable(row, "notes"),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToLine(row: Record<string, unknown>): RecurringInvoiceTemplateLineItem {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 0),
    unitAmountCents: Number(row.unit_amount_cents ?? 0),
    taxRateBps: Number(row.tax_rate_bps ?? 0),
    amountCents: Number(row.amount_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function filterClauses(filter: RecurringInvoiceTemplateFilter): { clauses: string[]; binds: unknown[] } {
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
  if (filter.statuses?.length) {
    clauses.push(`status IN (${filter.statuses.map(() => "?").join(", ")})`);
    binds.push(...filter.statuses);
  }
  if (filter.dueOnOrBefore) {
    clauses.push("next_invoice_at IS NOT NULL", "next_invoice_at <= ?");
    binds.push(filter.dueOnOrBefore);
  }
  return { clauses, binds };
}

export function createD1RecurringInvoiceStore(db: D1Database): RecurringInvoiceStore {
  async function listLines(templateId: string): Promise<RecurringInvoiceTemplateLineItem[]> {
    const result = await db
      .prepare(`SELECT ${LINE_COLS} FROM invoice_recurring_template_line_items WHERE template_id = ? ORDER BY sort_order ASC`)
      .bind(templateId)
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToLine);
  }

  async function withLineItems(template: RecurringInvoiceTemplate): Promise<RecurringInvoiceTemplateWithLineItems> {
    return { ...template, lineItems: await listLines(template.id) };
  }

  return {
    async insertTemplate(template, lineItems) {
      const statements = [
        db
          .prepare(`INSERT INTO invoice_recurring_templates (${TEMPLATE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            template.id,
            template.tenantId,
            template.customerId,
            template.name,
            template.series,
            template.currency,
            template.frequency,
            template.customDays,
            template.status,
            template.startAt,
            template.endAt,
            template.nextInvoiceAt,
            template.lastInvoiceAt,
            template.paymentTermsDays,
            template.maxOccurrences,
            template.invoicesGenerated,
            template.autoIssue ? 1 : 0,
            template.notes,
            template.subtotalCents,
            template.taxCents,
            template.totalCents,
            template.createdAt,
            template.updatedAt
          ),
        ...lineItems.map((line) =>
          db
            .prepare(`INSERT INTO invoice_recurring_template_line_items (${LINE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              line.id,
              line.templateId,
              line.description,
              line.quantity,
              line.unitAmountCents,
              line.taxRateBps,
              line.amountCents,
              line.sortOrder,
              line.createdAt,
              line.updatedAt
            )
        )
      ];
      await db.batch(statements);
    },

    async getTemplate(tenantId, templateId) {
      const row = await db
        .prepare(`SELECT ${TEMPLATE_COLS} FROM invoice_recurring_templates WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, templateId)
        .first<Record<string, unknown>>();
      return row ? withLineItems(rowToTemplate(row)) : null;
    },

    async listTemplates(filter) {
      const { clauses, binds } = filterClauses(filter);
      const result = await db
        .prepare(
          `SELECT ${TEMPLATE_COLS} FROM invoice_recurring_templates
           WHERE ${clauses.join(" AND ")}
           ORDER BY next_invoice_at ASC, name ASC
           LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return Promise.all((result.results ?? []).map((row) => withLineItems(rowToTemplate(row))));
    },

    async updateTemplate(template) {
      await db
        .prepare(
          `UPDATE invoice_recurring_templates
           SET customer_id = ?,
               name = ?,
               series = ?,
               currency = ?,
               frequency = ?,
               custom_days = ?,
               status = ?,
               start_at = ?,
               end_at = ?,
               next_invoice_at = ?,
               last_invoice_at = ?,
               payment_terms_days = ?,
               max_occurrences = ?,
               invoices_generated = ?,
               auto_issue = ?,
               notes = ?,
               subtotal_cents = ?,
               tax_cents = ?,
               total_cents = ?,
               updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          template.customerId,
          template.name,
          template.series,
          template.currency,
          template.frequency,
          template.customDays,
          template.status,
          template.startAt,
          template.endAt,
          template.nextInvoiceAt,
          template.lastInvoiceAt,
          template.paymentTermsDays,
          template.maxOccurrences,
          template.invoicesGenerated,
          template.autoIssue ? 1 : 0,
          template.notes,
          template.subtotalCents,
          template.taxCents,
          template.totalCents,
          template.updatedAt,
          template.tenantId,
          template.id
        )
        .run();
    }
  };
}
