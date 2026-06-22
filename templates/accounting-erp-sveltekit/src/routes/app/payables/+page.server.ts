import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  createBill,
  createRecurringBillTemplate,
  createVendor,
  generateDueRecurringBills,
  get1099VendorReport,
  getAgingReport,
  listBills,
  listRecurringBillTemplates,
  listVendors,
  markBillPayable,
  postBillToAccounting,
  recordBillPayment,
  updateRecurringBillTemplateStatus,
  type AccountsPayableStore,
  type BillPaymentMethod,
  type RecurringBillFrequency,
  type RecurringBillStatus
} from "@microservices-sh/accounts-payable";
import { getAccountingSetupStatus, listAccounts, type AccountingCoreStore } from "@microservices-sh/accounting-core";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { createAccountsPayableAccountingPoster } from "$lib/server/accounts-payable-accounting";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function nonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function dateToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const RECURRING_BILL_FREQUENCIES = new Set<RecurringBillFrequency>(["weekly", "monthly", "quarterly", "yearly", "custom"]);
const RECURRING_BILL_STATUSES = new Set<RecurringBillStatus>(["active", "paused", "cancelled", "completed"]);
const BILL_PAYMENT_METHODS = new Set<BillPaymentMethod>(["check", "ach", "wire", "card", "cash", "other"]);

function recurringBillFrequency(value: string): RecurringBillFrequency | null {
  return RECURRING_BILL_FREQUENCIES.has(value as RecurringBillFrequency) ? (value as RecurringBillFrequency) : null;
}

function recurringBillStatus(value: string): RecurringBillStatus | null {
  return RECURRING_BILL_STATUSES.has(value as RecurringBillStatus) ? (value as RecurringBillStatus) : null;
}

function billPaymentMethod(value: string): BillPaymentMethod | null {
  return BILL_PAYMENT_METHODS.has(value as BillPaymentMethod) ? (value as BillPaymentMethod) : null;
}

function paymentApplications(form: FormData) {
  return form
    .getAll("applicationBillId")
    .map((value) => text(value))
    .filter(Boolean)
    .map((billId) => ({
      billId,
      amountCents: cents(text(form.get(`applicationAmount-${billId}`))) ?? 0
    }))
    .filter((application) => application.amountCents > 0);
}

function paymentIdempotencyKey(input: {
  vendorId: string;
  paymentDate: string;
  referenceNumber: string;
  applications: Array<{ billId: string; amountCents: number }>;
}) {
  const applied = input.applications.map((application) => `${application.billId}:${application.amountCents}`).join(",");
  return `ap-payment:${input.vendorId}:${input.paymentDate}:${input.referenceNumber || "manual"}:${applied}`;
}

async function defaultApAccount(accountingCoreStore: AccountingCoreStore, tenantId: string) {
  const settings = await accountingCoreStore.getAccountingSettings(tenantId);
  return { accountId: settings?.defaultApAccountId ?? null, settingsConfigured: Boolean(settings) };
}

async function defaultExpenseAccount(accountsPayableStore: AccountsPayableStore, tenantId: string, vendorId: string) {
  const vendor = await accountsPayableStore.getVendor(tenantId, vendorId);
  return vendor?.defaultExpenseAccountId ?? null;
}

async function checkedExpenseAccountId(
  accountingCoreStore: AccountingCoreStore,
  tenantId: string,
  accountId: string | null
): Promise<string | null> {
  if (!accountId) return null;
  const account = await accountingCoreStore.getAccount(tenantId, accountId);
  if (!account || account.type !== "expense" || account.isHeader || !account.active) return null;
  return account.id;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const reportYear = new Date().getUTCFullYear();
  const [vendorsResult, billsResult, agingResult, accountsResult, recurringTemplatesResult, setupStatus, report1099Result] = await Promise.all([
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 250 }, { accountsPayableStore: locals.accountsPayableStore }),
    listBills({ tenantId: activeOrgId, limit: 100 }, { accountsPayableStore: locals.accountsPayableStore }),
    getAgingReport({ tenantId: activeOrgId }, { accountsPayableStore: locals.accountsPayableStore }),
    listAccounts({ tenantId: activeOrgId, includeInactive: false, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore }),
    listRecurringBillTemplates({ tenantId: activeOrgId, limit: 100 }, { accountsPayableStore: locals.accountsPayableStore }),
    getAccountingSetupStatus({ tenantId: activeOrgId }, { accountingCoreStore: locals.accountingCoreStore }),
    get1099VendorReport({ tenantId: activeOrgId, year: reportYear }, { accountsPayableStore: locals.accountsPayableStore })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    vendors: vendorsResult.ok ? vendorsResult.data.vendors : [],
    bills: billsResult.ok ? billsResult.data.bills : [],
    aging: agingResult.ok ? agingResult.data.report : null,
    accounts: accountsResult.ok ? accountsResult.data.accounts : [],
    defaultApAccountId: setupStatus.ok ? setupStatus.data.status.settings?.defaultApAccountId ?? null : null,
    recurringBillTemplates: recurringTemplatesResult.ok ? recurringTemplatesResult.data.templates : [],
    report1099: report1099Result.ok ? report1099Result.data.report : null,
    today: today()
  };
};

export const actions: Actions = {
  createVendor: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      email: text(form.get("email")),
      phone: text(form.get("phone")),
      addressLine1: text(form.get("addressLine1")),
      city: text(form.get("city")),
      state: text(form.get("state")),
      postalCode: text(form.get("postalCode")),
      country: text(form.get("country")),
      taxId: text(form.get("taxId")),
      is1099Vendor: text(form.get("is1099Vendor")) === "true",
      currency: text(form.get("currency")).toUpperCase() || "USD",
      defaultExpenseAccountId: text(form.get("defaultExpenseAccountId")),
      defaultPaymentTermsDays: text(form.get("defaultPaymentTermsDays")),
      notes: text(form.get("notes"))
    };
    if (!values.name) return fail(400, { error: "Enter a vendor name.", values });
    const defaultPaymentTermsDays = values.defaultPaymentTermsDays ? nonNegativeInteger(values.defaultPaymentTermsDays) : 30;
    if (defaultPaymentTermsDays == null) return fail(400, { error: "Enter valid payment terms.", values });
    const defaultExpenseAccountId = await checkedExpenseAccountId(
      locals.accountingCoreStore,
      org.id,
      values.defaultExpenseAccountId || null
    );
    if (values.defaultExpenseAccountId && !defaultExpenseAccountId) {
      return fail(400, { error: "Choose an active expense account for the vendor default.", values });
    }

    const result = await createVendor(
      {
        tenantId: org.id,
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        addressLine1: values.addressLine1 || null,
        city: values.city || null,
        state: values.state || null,
        postalCode: values.postalCode || null,
        country: values.country || null,
        taxId: values.taxId || null,
        currency: values.currency,
        is1099Vendor: values.is1099Vendor,
        defaultExpenseAccountId,
        defaultPaymentTermsDays,
        notes: values.notes || null
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.vendor_created",
        actorId: locals.user.id,
        entityType: "vendor",
        entityId: result.data.vendor.id,
        source: "app/payables",
        payload: { name: result.data.vendor.name }
      },
      { auditStore: locals.auditStore }
    );

    return { vendorCreated: true };
  },

  createBill: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      vendorId: text(form.get("vendorId")),
      billNumber: text(form.get("billNumber")),
      billDate: text(form.get("billDate")),
      dueDate: text(form.get("dueDate")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      unitAmount: text(form.get("unitAmount")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      memo: text(form.get("memo")),
      expenseAccountId: text(form.get("expenseAccountId")),
      apAccountId: text(form.get("apAccountId"))
    };
    const quantity = positiveInteger(values.quantity);
    const unitAmountCents = cents(values.unitAmount);
    const billDate = dateToIso(values.billDate);
    const dueDate = dateToIso(values.dueDate);
    if (!values.vendorId || !values.description || !quantity || unitAmountCents == null || !billDate || !dueDate) {
      return fail(400, { error: "Enter vendor, dates, line description, quantity, and amount.", values });
    }
    const apDefault = await defaultApAccount(locals.accountingCoreStore, org.id);
    const apAccountId = values.apAccountId || apDefault.accountId;
    const expenseAccountId = await checkedExpenseAccountId(
      locals.accountingCoreStore,
      org.id,
      values.expenseAccountId || (await defaultExpenseAccount(locals.accountsPayableStore, org.id, values.vendorId))
    );
    if (!expenseAccountId) {
      return fail(400, { error: "Choose an expense account or set a default on the vendor.", values });
    }

    const result = await createBill(
      {
        tenantId: org.id,
        vendorId: values.vendorId,
        billNumber: values.billNumber || undefined,
        billDate,
        dueDate,
        currency: values.currency,
        memo: values.memo || null,
        apAccountId,
        requiresApproval: false,
        lineItems: [{ description: values.description, quantity, unitAmountCents, taxCents: 0, expenseAccountId }]
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.bill_created",
        actorId: locals.user.id,
        entityType: "bill",
        entityId: result.data.bill.id,
        source: "app/payables",
        payload: { vendorId: values.vendorId, totalCents: result.data.bill.totalCents }
      },
      { auditStore: locals.auditStore }
    );

    return { billCreated: true };
  },

  createRecurringBillTemplate: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      vendorId: text(form.get("vendorId")),
      frequency: recurringBillFrequency(text(form.get("frequency"))),
      customDays: text(form.get("customDays")),
      startDate: text(form.get("startDate")),
      paymentTermsDays: text(form.get("paymentTermsDays")),
      maxOccurrences: text(form.get("maxOccurrences")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      unitAmount: text(form.get("unitAmount")),
      taxAmount: text(form.get("taxAmount")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      memo: text(form.get("memo")),
      expenseAccountId: text(form.get("expenseAccountId"))
    };
    const quantity = positiveInteger(values.quantity);
    const unitAmountCents = cents(values.unitAmount);
    const taxAmountCents = cents(values.taxAmount);
    const taxCents = taxAmountCents ?? 0;
    const startDate = dateToIso(values.startDate);
    const customDays = positiveInteger(values.customDays);
    const paymentTermsDays = values.paymentTermsDays ? positiveInteger(values.paymentTermsDays) : 30;
    const maxOccurrences = values.maxOccurrences ? positiveInteger(values.maxOccurrences) : null;

    if (
      !values.name ||
      !values.vendorId ||
      !values.frequency ||
      !startDate ||
      (values.frequency === "custom" && !customDays) ||
      !values.description ||
      !quantity ||
      unitAmountCents == null ||
      (values.taxAmount && taxAmountCents == null) ||
      paymentTermsDays == null ||
      (values.maxOccurrences && !maxOccurrences)
    ) {
      return fail(400, { error: "Enter vendor, schedule, start date, line description, quantity, and amount.", values });
    }

    const expenseAccountId = await checkedExpenseAccountId(
      locals.accountingCoreStore,
      org.id,
      values.expenseAccountId || (await defaultExpenseAccount(locals.accountsPayableStore, org.id, values.vendorId))
    );
    if (!expenseAccountId) {
      return fail(400, { error: "Choose an expense account or set a default on the vendor.", values });
    }

    const result = await createRecurringBillTemplate(
      {
        tenantId: org.id,
        name: values.name,
        vendorId: values.vendorId,
        frequency: values.frequency,
        customDays,
        startDate,
        paymentTermsDays,
        maxOccurrences,
        currency: values.currency,
        memo: values.memo || null,
        autoMarkPayable: false,
        lineItems: [
          {
            description: values.description,
            quantity,
            unitAmountCents,
            taxCents,
            expenseAccountId
          }
        ]
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.recurring_bill_template_created",
        actorId: locals.user.id,
        entityType: "recurring_bill_template",
        entityId: result.data.template.id,
        source: "app/payables",
        payload: {
          vendorId: values.vendorId,
          frequency: values.frequency,
          nextBillDate: result.data.template.nextBillDate,
          totalCents: result.data.template.totalCents
        }
      },
      { auditStore: locals.auditStore }
    );

    return { recurringBillTemplateCreated: true };
  },

  updateRecurringBillStatus: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      templateId: text(form.get("templateId")),
      status: recurringBillStatus(text(form.get("status")))
    };
    if (!values.templateId || !values.status) return fail(400, { error: "Choose a recurring bill schedule and status.", values });

    const result = await updateRecurringBillTemplateStatus(
      {
        tenantId: org.id,
        templateId: values.templateId,
        status: values.status
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.recurring_bill_template_status_updated",
        actorId: locals.user.id,
        entityType: "recurring_bill_template",
        entityId: result.data.template.id,
        source: "app/payables",
        payload: { status: result.data.template.status }
      },
      { auditStore: locals.auditStore }
    );

    return { recurringBillStatusUpdated: true };
  },

  generateDueRecurringBills: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      asOfDate: text(form.get("asOfDate")),
      limit: text(form.get("limit"))
    };
    const asOfDate = dateToIso(values.asOfDate) ?? new Date().toISOString();
    const limit = positiveInteger(values.limit) ?? 25;

    const result = await generateDueRecurringBills(
      {
        tenantId: org.id,
        asOfDate,
        limit,
        postToAccounting: false
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        accountingPoster: createAccountsPayableAccountingPoster({
          accountingCoreStore: locals.accountingCoreStore,
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }),
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.recurring_bill_generated",
        actorId: locals.user.id,
        entityType: "recurring_bill_generation",
        entityId: org.id,
        source: "app/payables",
        payload: {
          asOfDate,
          count: result.data.count,
          createdCount: result.data.createdCount,
          dedupedCount: result.data.dedupedCount
        }
      },
      { auditStore: locals.auditStore }
    );

    return { recurringBillsGenerated: true, generatedBillCount: result.data.count };
  },

  markPayable: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      billId: text(form.get("billId")),
      apAccountId: text(form.get("apAccountId"))
    };
    if (!values.billId) return fail(400, { error: "Choose a bill.", values });
    const apDefault = await defaultApAccount(locals.accountingCoreStore, org.id);
    const apAccountId = values.apAccountId || apDefault.accountId;
    if (!apAccountId) {
      return fail(400, {
        error: apDefault.settingsConfigured
          ? "Choose Accounts Payable in Accounting settings before posting to accounting."
          : "Choose an AP account.",
        values
      });
    }

    try {
      const result = await markBillPayable(
        {
          tenantId: org.id,
          billId: values.billId,
          approvedById: locals.user.id,
          apAccountId,
          postToAccounting: false
        },
        {
          accountsPayableStore: locals.accountsPayableStore,
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (!result.ok) return fail(result.status, { error: result.error.message, values });

      await recordEvent(
        {
          eventName: "accounts-payable.bill_marked_payable",
          actorId: locals.user.id,
          entityType: "bill",
          entityId: result.data.bill.id,
          source: "app/payables",
          payload: { accountingStatus: result.data.bill.accountingStatus }
        },
        { auditStore: locals.auditStore }
      );

      return { billMarkedPayable: true };
    } catch (error) {
      return fail(409, { error: error instanceof Error ? error.message : "Could not approve bill.", values });
    }
  },

  postBillToAccounting: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      billId: text(form.get("billId")),
      apAccountId: text(form.get("apAccountId"))
    };
    if (!values.billId) return fail(400, { error: "Choose a bill.", values });
    const apDefault = await defaultApAccount(locals.accountingCoreStore, org.id);
    const apAccountId = values.apAccountId || apDefault.accountId;
    if (!apAccountId) {
      return fail(400, {
        error: apDefault.settingsConfigured
          ? "Choose Accounts Payable in Accounting settings before posting to accounting."
          : "Choose an AP account.",
        values
      });
    }

    try {
      const result = await postBillToAccounting(
        {
          tenantId: org.id,
          billId: values.billId,
          apAccountId,
          postedById: locals.user.id
        },
        {
          accountsPayableStore: locals.accountsPayableStore,
          accountingPoster: createAccountsPayableAccountingPoster({
            accountingCoreStore: locals.accountingCoreStore,
            actor: { id: locals.user.id, email: locals.user.email, permissions }
          }),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (!result.ok) return fail(result.status, { error: result.error.message, values });

      await recordEvent(
        {
          eventName: "accounts-payable.bill_posted",
          actorId: locals.user.id,
          entityType: "bill",
          entityId: result.data.bill.id,
          source: "app/payables",
          payload: { journalEntryId: result.data.bill.journalEntryId, accountingStatus: result.data.bill.accountingStatus }
        },
        { auditStore: locals.auditStore }
      );

      return { billPosted: true };
    } catch (error) {
      return fail(409, { error: error instanceof Error ? error.message : "Could not post bill to accounting.", values });
    }
  },

  recordPayment: async ({ request, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const applications = paymentApplications(form);
    const values = {
      billId: text(form.get("billId")),
      vendorId: text(form.get("vendorId")),
      paymentDate: text(form.get("paymentDate")),
      paymentAccountId: text(form.get("paymentAccountId")),
      paymentMethod: billPaymentMethod(text(form.get("paymentMethod"))) ?? "ach",
      referenceNumber: text(form.get("referenceNumber")),
      memo: text(form.get("memo"))
    };
    const paymentDate = dateToIso(values.paymentDate);
    if ((!values.billId && applications.length === 0) || !paymentDate || !values.paymentAccountId) {
      return fail(400, { error: "Choose a bill, payment date, and payment account.", values });
    }
    if (applications.length > 0 && !values.vendorId) {
      return fail(400, { error: "Choose a vendor for the payment workbench.", values });
    }

    if (applications.length > 0) {
      const amountCents = applications.reduce((sum, application) => sum + application.amountCents, 0);
      const billsResult = await listBills({ tenantId: org.id, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore });
      if (!billsResult.ok) return fail(billsResult.status, { error: billsResult.error.message, values });
      const selectedBills = applications.map((application) =>
        billsResult.data.bills.find((candidate) => candidate.id === application.billId)
      );
      if (selectedBills.some((bill) => !bill)) return fail(404, { error: "One or more selected bills were not found.", values });
      const currencies = new Set(selectedBills.map((bill) => bill?.currency));
      if (currencies.size !== 1) return fail(409, { error: "Select bills in one currency per payment.", values });
      const currency = selectedBills[0]?.currency ?? "USD";
      try {
        const result = await recordBillPayment(
          {
            tenantId: org.id,
            vendorId: values.vendorId,
            paymentDate,
            amountCents,
            currency,
            paymentAccountId: values.paymentAccountId,
            paymentMethod: values.paymentMethod,
            referenceNumber: values.referenceNumber || null,
            memo: values.memo || null,
            idempotencyKey: paymentIdempotencyKey({
              vendorId: values.vendorId,
              paymentDate,
              referenceNumber: values.referenceNumber,
              applications
            }),
            applications
          },
          {
            accountsPayableStore: locals.accountsPayableStore,
            accountingPoster: createAccountsPayableAccountingPoster({
              accountingCoreStore: locals.accountingCoreStore,
              actor: { id: locals.user.id, email: locals.user.email, permissions }
            }),
            actor: { id: locals.user.id, email: locals.user.email, permissions }
          }
        );
        if (!result.ok) return fail(result.status, { error: result.error.message, values });

        await recordEvent(
          {
            eventName: "accounts-payable.bill_payment_recorded",
            actorId: locals.user.id,
            entityType: "bill_payment",
            entityId: result.data.payment.id,
            source: "app/payables",
            payload: {
              vendorId: values.vendorId,
              billIds: applications.map((application) => application.billId),
              amountCents: result.data.payment.amountCents,
              journalEntryId: result.data.payment.journalEntryId
            }
          },
          { auditStore: locals.auditStore }
        );

        return { billPaymentRecorded: true, paidBillCount: applications.length };
      } catch (error) {
        return fail(409, { error: error instanceof Error ? error.message : "Could not post payment to accounting.", values });
      }
    }

    const billsResult = await listBills({ tenantId: org.id, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore });
    if (!billsResult.ok) return fail(billsResult.status, { error: billsResult.error.message, values });
    const bill = billsResult.data.bills.find((candidate) => candidate.id === values.billId);
    if (!bill) return fail(404, { error: "Bill not found.", values });
    if (bill.amountDueCents <= 0) return fail(409, { error: "Bill has no open balance.", values });

    try {
      const result = await recordBillPayment(
        {
          tenantId: org.id,
          vendorId: bill.vendorId,
          paymentDate,
          amountCents: bill.amountDueCents,
          currency: bill.currency,
          paymentAccountId: values.paymentAccountId,
          paymentMethod: values.paymentMethod,
          referenceNumber: values.referenceNumber || null,
          memo: values.memo || null,
          idempotencyKey: `ap-payment:${bill.id}:${paymentDate}`,
          applications: [{ billId: bill.id, amountCents: bill.amountDueCents }]
        },
        {
          accountsPayableStore: locals.accountsPayableStore,
          accountingPoster: createAccountsPayableAccountingPoster({
            accountingCoreStore: locals.accountingCoreStore,
            actor: { id: locals.user.id, email: locals.user.email, permissions }
          }),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (!result.ok) return fail(result.status, { error: result.error.message, values });

      await recordEvent(
        {
          eventName: "accounts-payable.bill_payment_recorded",
          actorId: locals.user.id,
          entityType: "bill_payment",
          entityId: result.data.payment.id,
          source: "app/payables",
          payload: { billId: bill.id, amountCents: result.data.payment.amountCents, journalEntryId: result.data.payment.journalEntryId }
        },
        { auditStore: locals.auditStore }
      );

      return { billPaymentRecorded: true };
    } catch (error) {
      return fail(409, { error: error instanceof Error ? error.message : "Could not post payment to accounting.", values });
    }
  }
};
