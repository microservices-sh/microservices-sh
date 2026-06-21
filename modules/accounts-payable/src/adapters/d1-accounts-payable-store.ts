import type { AccountsPayableStore } from "../ports";
import type {
  Bill,
  BillFilter,
  BillLineItem,
  BillPayment,
  BillPaymentApplication,
  BillPaymentWithApplications,
  BillStatus,
  BillWithLineItems,
  RecurringBillFrequency,
  RecurringBillLineItem,
  RecurringBillTemplateFilter,
  RecurringBillStatus,
  RecurringBillTemplate,
  RecurringBillTemplateWithLineItems,
  Vendor,
  VendorFilter
} from "../types";
import { accountsPayableId } from "../service";

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function rowToVendor(row: Record<string, unknown>): Vendor {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    email: nullable(row.email),
    phone: nullable(row.phone),
    addressLine1: nullable(row.address_line_1),
    city: nullable(row.city),
    state: nullable(row.state),
    postalCode: nullable(row.postal_code),
    country: nullable(row.country),
    taxId: nullable(row.tax_id),
    is1099Vendor: bool(row.is_1099_vendor),
    defaultExpenseAccountId: nullable(row.default_expense_account_id),
    defaultPaymentTermsDays: Number(row.default_payment_terms_days ?? 30),
    currency: String(row.currency ?? "USD"),
    externalId: nullable(row.external_id),
    externalSource: nullable(row.external_source),
    notes: nullable(row.notes),
    active: bool(row.active),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToBill(row: Record<string, unknown>): Bill {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    billNumber: String(row.bill_number),
    vendorId: String(row.vendor_id),
    vendorBillNumber: nullable(row.vendor_bill_number),
    status: String(row.status) as BillStatus,
    accountingStatus: String(row.accounting_status ?? "unposted") as Bill["accountingStatus"],
    billDate: String(row.bill_date),
    dueDate: String(row.due_date),
    paidAt: nullable(row.paid_at),
    currency: String(row.currency ?? "USD"),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    amountPaidCents: Number(row.amount_paid_cents ?? 0),
    amountDueCents: Number(row.amount_due_cents ?? 0),
    memo: nullable(row.memo),
    apAccountId: nullable(row.ap_account_id),
    journalEntryId: nullable(row.journal_entry_id),
    approvedById: nullable(row.approved_by_id),
    approvedAt: nullable(row.approved_at),
    postedAt: nullable(row.posted_at),
    voidedAt: nullable(row.voided_at),
    voidReason: nullable(row.void_reason),
    recurringTemplateId: nullable(row.recurring_template_id),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToLine(row: Record<string, unknown>): BillLineItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    billId: String(row.bill_id),
    expenseAccountId: nullable(row.expense_account_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 1),
    unitAmountCents: Number(row.unit_amount_cents ?? 0),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToPayment(row: Record<string, unknown>): BillPayment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    paymentNumber: String(row.payment_number),
    vendorId: String(row.vendor_id),
    paymentDate: String(row.payment_date),
    amountCents: Number(row.amount_cents ?? 0),
    unappliedAmountCents: Number(row.unapplied_amount_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    paymentAccountId: nullable(row.payment_account_id),
    paymentMethod: nullable(row.payment_method) as BillPayment["paymentMethod"],
    referenceNumber: nullable(row.reference_number),
    memo: nullable(row.memo),
    status: String(row.status ?? "posted") as BillPayment["status"],
    idempotencyKey: nullable(row.idempotency_key),
    journalEntryId: nullable(row.journal_entry_id),
    postedAt: nullable(row.posted_at),
    voidedAt: nullable(row.voided_at),
    voidReason: nullable(row.void_reason),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToApplication(row: Record<string, unknown>): BillPaymentApplication {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    paymentId: String(row.payment_id),
    billId: String(row.bill_id),
    amountAppliedCents: Number(row.amount_applied_cents ?? 0),
    appliedAt: String(row.applied_at),
    createdAt: String(row.created_at)
  };
}

function rowToTemplate(row: Record<string, unknown>): RecurringBillTemplate {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    vendorId: String(row.vendor_id),
    frequency: String(row.frequency ?? "monthly") as RecurringBillFrequency,
    customDays: row.custom_days == null ? null : Number(row.custom_days),
    status: String(row.status ?? "active") as RecurringBillStatus,
    currency: String(row.currency ?? "USD"),
    paymentTermsDays: Number(row.payment_terms_days ?? 30),
    nextBillDate: String(row.next_bill_date),
    lastBillDate: nullable(row.last_bill_date),
    maxOccurrences: row.max_occurrences == null ? null : Number(row.max_occurrences),
    billsGenerated: Number(row.bills_generated ?? 0),
    memo: nullable(row.memo),
    autoMarkPayable: bool(row.auto_mark_payable),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToRecurringLine(row: Record<string, unknown>): RecurringBillLineItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    recurringBillTemplateId: String(row.recurring_bill_template_id),
    expenseAccountId: nullable(row.expense_account_id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 1),
    unitAmountCents: Number(row.unit_amount_cents ?? 0),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

const VENDOR_COLS =
  "id, tenant_id, name, email, phone, address_line_1, city, state, postal_code, country, tax_id, is_1099_vendor, default_expense_account_id, default_payment_terms_days, currency, external_id, external_source, notes, active, created_by_id, created_at, updated_at";
const BILL_COLS =
  "id, tenant_id, bill_number, vendor_id, vendor_bill_number, status, accounting_status, bill_date, due_date, paid_at, currency, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, memo, ap_account_id, journal_entry_id, approved_by_id, approved_at, posted_at, voided_at, void_reason, recurring_template_id, created_by_id, created_at, updated_at";
const LINE_COLS =
  "id, tenant_id, bill_id, expense_account_id, description, quantity, unit_amount_cents, subtotal_cents, tax_cents, total_cents, sort_order, created_at, updated_at";
const PAYMENT_COLS =
  "id, tenant_id, payment_number, vendor_id, payment_date, amount_cents, unapplied_amount_cents, currency, payment_account_id, payment_method, reference_number, memo, status, idempotency_key, journal_entry_id, posted_at, voided_at, void_reason, created_by_id, created_at, updated_at";
const APPLICATION_COLS = "id, tenant_id, payment_id, bill_id, amount_applied_cents, applied_at, created_at";
const TEMPLATE_COLS =
  "id, tenant_id, name, vendor_id, frequency, custom_days, status, currency, payment_terms_days, next_bill_date, last_bill_date, max_occurrences, bills_generated, memo, auto_mark_payable, subtotal_cents, tax_cents, total_cents, created_by_id, created_at, updated_at";
const RECURRING_LINE_COLS =
  "id, tenant_id, recurring_bill_template_id, expense_account_id, description, quantity, unit_amount_cents, subtotal_cents, tax_cents, total_cents, sort_order, created_at, updated_at";

export function createD1AccountsPayableStore(db: D1Database): AccountsPayableStore {
  async function listLineItems(tenantId: string, billId: string): Promise<BillLineItem[]> {
    const result = await db
      .prepare(
        `SELECT ${LINE_COLS} FROM accounts_payable_bill_line_items WHERE tenant_id = ? AND bill_id = ? ORDER BY sort_order ASC`
      )
      .bind(tenantId, billId)
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToLine);
  }

  async function withLineItems(bill: Bill): Promise<BillWithLineItems> {
    return { ...bill, lineItems: await listLineItems(bill.tenantId, bill.id) };
  }

  async function listApplications(tenantId: string, paymentId: string): Promise<BillPaymentApplication[]> {
    const result = await db
      .prepare(
        `SELECT ${APPLICATION_COLS} FROM accounts_payable_bill_payment_applications WHERE tenant_id = ? AND payment_id = ? ORDER BY rowid ASC`
      )
      .bind(tenantId, paymentId)
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToApplication);
  }

  async function listRecurringLineItems(
    tenantId: string,
    templateId: string
  ): Promise<RecurringBillLineItem[]> {
    const result = await db
      .prepare(
        `SELECT ${RECURRING_LINE_COLS} FROM accounts_payable_recurring_bill_line_items WHERE tenant_id = ? AND recurring_bill_template_id = ? ORDER BY sort_order ASC`
      )
      .bind(tenantId, templateId)
      .all<Record<string, unknown>>();
    return (result.results ?? []).map(rowToRecurringLine);
  }

  async function withRecurringLineItems(
    template: RecurringBillTemplate
  ): Promise<RecurringBillTemplateWithLineItems> {
    return { ...template, lineItems: await listRecurringLineItems(template.tenantId, template.id) };
  }

  function recurringTemplateFilterClauses(filter: RecurringBillTemplateFilter): {
    clauses: string[];
    binds: unknown[];
  } {
    const clauses = ["tenant_id = ?"];
    const binds: unknown[] = [filter.tenantId];
    if (filter.vendorId) {
      clauses.push("vendor_id = ?");
      binds.push(filter.vendorId);
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
      clauses.push("next_bill_date <= ?");
      binds.push(filter.dueOnOrBefore);
    }
    return { clauses, binds };
  }

  return {
    async insertVendor(vendor) {
      await db
        .prepare(
          `INSERT INTO accounts_payable_vendors (${VENDOR_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          vendor.id,
          vendor.tenantId,
          vendor.name,
          vendor.email,
          vendor.phone,
          vendor.addressLine1,
          vendor.city,
          vendor.state,
          vendor.postalCode,
          vendor.country,
          vendor.taxId,
          vendor.is1099Vendor ? 1 : 0,
          vendor.defaultExpenseAccountId,
          vendor.defaultPaymentTermsDays,
          vendor.currency,
          vendor.externalId,
          vendor.externalSource,
          vendor.notes,
          vendor.active ? 1 : 0,
          vendor.createdById,
          vendor.createdAt,
          vendor.updatedAt
        )
        .run();
    },

    async getVendor(tenantId, vendorId) {
      const row = await db
        .prepare(`SELECT ${VENDOR_COLS} FROM accounts_payable_vendors WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, vendorId)
        .first<Record<string, unknown>>();
      return row ? rowToVendor(row) : null;
    },

    async findVendorByExternalRef(tenantId, externalSource, externalId) {
      const row = await db
        .prepare(
          `SELECT ${VENDOR_COLS} FROM accounts_payable_vendors WHERE tenant_id = ? AND external_source = ? AND external_id = ?`
        )
        .bind(tenantId, externalSource, externalId)
        .first<Record<string, unknown>>();
      return row ? rowToVendor(row) : null;
    },

    async listVendors(filter: VendorFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (!filter.includeInactive && filter.active === undefined) clauses.push("active = 1");
      if (filter.active !== undefined) {
        clauses.push("active = ?");
        binds.push(filter.active ? 1 : 0);
      }
      if (filter.externalSource) {
        clauses.push("external_source = ?");
        binds.push(filter.externalSource);
      }
      if (filter.search) {
        clauses.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
        const pattern = `%${filter.search}%`;
        binds.push(pattern, pattern, pattern);
      }
      const result = await db
        .prepare(
          `SELECT ${VENDOR_COLS} FROM accounts_payable_vendors WHERE ${clauses.join(" AND ")} ORDER BY name ASC LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToVendor);
    },

    async insertBill(bill, lineItems) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO accounts_payable_bills (${BILL_COLS})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            bill.id,
            bill.tenantId,
            bill.billNumber,
            bill.vendorId,
            bill.vendorBillNumber,
            bill.status,
            bill.accountingStatus,
            bill.billDate,
            bill.dueDate,
            bill.paidAt,
            bill.currency,
            bill.subtotalCents,
            bill.taxCents,
            bill.totalCents,
            bill.amountPaidCents,
            bill.amountDueCents,
            bill.memo,
            bill.apAccountId,
            bill.journalEntryId,
            bill.approvedById,
            bill.approvedAt,
            bill.postedAt,
            bill.voidedAt,
            bill.voidReason,
            bill.recurringTemplateId,
            bill.createdById,
            bill.createdAt,
            bill.updatedAt
          ),
        ...lineItems.map((line) =>
          db
            .prepare(
              `INSERT INTO accounts_payable_bill_line_items (${LINE_COLS})
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              line.id,
              line.tenantId,
              line.billId,
              line.expenseAccountId,
              line.description,
              line.quantity,
              line.unitAmountCents,
              line.subtotalCents,
              line.taxCents,
              line.totalCents,
              line.sortOrder,
              line.createdAt,
              line.updatedAt
            )
        )
      ]);
    },

    async updateBill(bill) {
      await db
        .prepare(
          `UPDATE accounts_payable_bills
           SET status = ?, accounting_status = ?, paid_at = ?, amount_paid_cents = ?, amount_due_cents = ?,
             ap_account_id = ?, journal_entry_id = ?, approved_by_id = ?, approved_at = ?, posted_at = ?,
             voided_at = ?, void_reason = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          bill.status,
          bill.accountingStatus,
          bill.paidAt,
          bill.amountPaidCents,
          bill.amountDueCents,
          bill.apAccountId,
          bill.journalEntryId,
          bill.approvedById,
          bill.approvedAt,
          bill.postedAt,
          bill.voidedAt,
          bill.voidReason,
          bill.updatedAt,
          bill.tenantId,
          bill.id
        )
        .run();
    },

    async getBill(tenantId, billId) {
      const row = await db
        .prepare(`SELECT ${BILL_COLS} FROM accounts_payable_bills WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, billId)
        .first<Record<string, unknown>>();
      return row ? withLineItems(rowToBill(row)) : null;
    },

    async findBillByRecurringOccurrence(tenantId, recurringTemplateId, billDate) {
      const row = await db
        .prepare(
          `SELECT ${BILL_COLS}
           FROM accounts_payable_bills
           WHERE tenant_id = ? AND recurring_template_id = ? AND bill_date = ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .bind(tenantId, recurringTemplateId, billDate)
        .first<Record<string, unknown>>();
      return row ? withLineItems(rowToBill(row)) : null;
    },

    async listBills(filter: BillFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.vendorId) {
        clauses.push("vendor_id = ?");
        binds.push(filter.vendorId);
      }
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter.statuses?.length) {
        clauses.push(`status IN (${filter.statuses.map(() => "?").join(", ")})`);
        binds.push(...filter.statuses);
      }
      const result = await db
        .prepare(`SELECT ${BILL_COLS} FROM accounts_payable_bills WHERE ${clauses.join(" AND ")} ORDER BY bill_date DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return Promise.all((result.results ?? []).map((row) => withLineItems(rowToBill(row))));
    },

    async listOpenBills(tenantId, vendorId) {
      const clauses = ["tenant_id = ?", "status IN ('payable', 'partial')", "amount_due_cents > 0"];
      const binds: unknown[] = [tenantId];
      if (vendorId) {
        clauses.push("vendor_id = ?");
        binds.push(vendorId);
      }
      const result = await db
        .prepare(`SELECT ${BILL_COLS} FROM accounts_payable_bills WHERE ${clauses.join(" AND ")} ORDER BY due_date ASC`)
        .bind(...binds)
        .all<Record<string, unknown>>();
      return Promise.all((result.results ?? []).map((row) => withLineItems(rowToBill(row))));
    },

    async findPaymentByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await db
        .prepare(
          `SELECT ${PAYMENT_COLS} FROM accounts_payable_bill_payments WHERE tenant_id = ? AND idempotency_key = ?`
        )
        .bind(tenantId, idempotencyKey)
        .first<Record<string, unknown>>();
      if (!row) return null;
      const payment = rowToPayment(row);
      return { ...payment, applications: await listApplications(tenantId, payment.id) };
    },

    async insertPaymentWithApplications({ payment, applications, updatedBills }) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO accounts_payable_bill_payments (${PAYMENT_COLS})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            payment.id,
            payment.tenantId,
            payment.paymentNumber,
            payment.vendorId,
            payment.paymentDate,
            payment.amountCents,
            payment.unappliedAmountCents,
            payment.currency,
            payment.paymentAccountId,
            payment.paymentMethod,
            payment.referenceNumber,
            payment.memo,
            payment.status,
            payment.idempotencyKey,
            payment.journalEntryId,
            payment.postedAt,
            payment.voidedAt,
            payment.voidReason,
            payment.createdById,
            payment.createdAt,
            payment.updatedAt
          ),
        ...applications.map((application) =>
          db
            .prepare(
              `INSERT INTO accounts_payable_bill_payment_applications (${APPLICATION_COLS})
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              application.id,
              application.tenantId,
              application.paymentId,
              application.billId,
              application.amountAppliedCents,
              application.appliedAt,
              application.createdAt
            )
        ),
        ...updatedBills.map((bill) =>
          db
            .prepare(
              `UPDATE accounts_payable_bills
               SET status = ?, paid_at = ?, amount_paid_cents = ?, amount_due_cents = ?, updated_at = ?
               WHERE tenant_id = ? AND id = ?`
            )
            .bind(bill.status, bill.paidAt, bill.amountPaidCents, bill.amountDueCents, bill.updatedAt, bill.tenantId, bill.id)
        )
      ]);
    },

    async insertRecurringBillTemplate(template, lineItems) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO accounts_payable_recurring_bill_templates (${TEMPLATE_COLS})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            template.id,
            template.tenantId,
            template.name,
            template.vendorId,
            template.frequency,
            template.customDays,
            template.status,
            template.currency,
            template.paymentTermsDays,
            template.nextBillDate,
            template.lastBillDate,
            template.maxOccurrences,
            template.billsGenerated,
            template.memo,
            template.autoMarkPayable ? 1 : 0,
            template.subtotalCents,
            template.taxCents,
            template.totalCents,
            template.createdById,
            template.createdAt,
            template.updatedAt
          ),
        ...lineItems.map((line) =>
          db
            .prepare(
              `INSERT INTO accounts_payable_recurring_bill_line_items (${RECURRING_LINE_COLS})
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              line.id,
              line.tenantId,
              line.recurringBillTemplateId,
              line.expenseAccountId,
              line.description,
              line.quantity,
              line.unitAmountCents,
              line.subtotalCents,
              line.taxCents,
              line.totalCents,
              line.sortOrder,
              line.createdAt,
              line.updatedAt
            )
        )
      ]);
    },

    async getRecurringBillTemplate(tenantId, templateId) {
      const row = await db
        .prepare(
          `SELECT ${TEMPLATE_COLS} FROM accounts_payable_recurring_bill_templates WHERE tenant_id = ? AND id = ?`
        )
        .bind(tenantId, templateId)
        .first<Record<string, unknown>>();
      if (!row) return null;
      return withRecurringLineItems(rowToTemplate(row));
    },

    async listRecurringBillTemplates(filter) {
      const { clauses, binds } = recurringTemplateFilterClauses(filter);
      const result = await db
        .prepare(
          `SELECT ${TEMPLATE_COLS} FROM accounts_payable_recurring_bill_templates WHERE ${clauses.join(" AND ")} ORDER BY next_bill_date ASC, name ASC LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return Promise.all((result.results ?? []).map((row) => withRecurringLineItems(rowToTemplate(row))));
    },

    async updateRecurringBillTemplate(template) {
      await db
        .prepare(
          `UPDATE accounts_payable_recurring_bill_templates
           SET status = ?, next_bill_date = ?, last_bill_date = ?, max_occurrences = ?, bills_generated = ?,
             memo = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          template.status,
          template.nextBillDate,
          template.lastBillDate,
          template.maxOccurrences,
          template.billsGenerated,
          template.memo,
          template.updatedAt,
          template.tenantId,
          template.id
        )
        .run();
    },

    async writeEvent(event) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(accountsPayableId("evt"), event.eventName, event.entityType, event.entityId, JSON.stringify(event))
        .run();
    }
  };
}
