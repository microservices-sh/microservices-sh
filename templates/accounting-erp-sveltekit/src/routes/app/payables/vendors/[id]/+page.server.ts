import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  getAgingReport,
  getVendor,
  listBillPayments,
  listBills,
  listRecurringBillTemplates,
  updateVendor,
  updateVendorStatus
} from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const activeTone = (active: boolean): Tone => (active ? "good" : "neutral");
const billTone = (status: string): Tone =>
  status === "paid" ? "good" : status === "void" ? "bad" : status === "draft" ? "neutral" : "warn";
const paymentTone = (status: string): Tone => (status === "posted" ? "good" : "bad");
const recurringTone = (status: string): Tone =>
  status === "active" ? "good" : status === "paused" ? "warn" : status === "cancelled" ? "bad" : "neutral";
const readinessTone = (ready: boolean, applicable: boolean): Tone => (!applicable ? "neutral" : ready ? "good" : "warn");

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function nonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

async function checkedExpenseAccountId(
  accountingCoreStore: App.Locals["accountingCoreStore"],
  tenantId: string,
  accountId: string | null
): Promise<string | null> {
  if (!accountId) return null;
  const account = await accountingCoreStore.getAccount(tenantId, accountId);
  if (!account || account.type !== "expense" || account.isHeader || !account.active) return null;
  return account.id;
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [vendorResult, billsResult, paymentsResult, recurringResult, agingResult, accountsResult] = await Promise.all([
    getVendor({ tenantId: activeOrgId, vendorId: params.id }, { accountsPayableStore: locals.accountsPayableStore }),
    listBills({ tenantId: activeOrgId, vendorId: params.id, limit: 100 }, { accountsPayableStore: locals.accountsPayableStore }),
    listBillPayments(
      { tenantId: activeOrgId, vendorId: params.id, limit: 100 },
      { accountsPayableStore: locals.accountsPayableStore }
    ),
    listRecurringBillTemplates(
      { tenantId: activeOrgId, vendorId: params.id, limit: 100 },
      { accountsPayableStore: locals.accountsPayableStore }
    ),
    getAgingReport({ tenantId: activeOrgId, vendorId: params.id }, { accountsPayableStore: locals.accountsPayableStore }),
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore })
  ]);
  if (!vendorResult.ok || !vendorResult.data) throw error(vendorResult.status, vendorResult.error.message);

  const vendor = vendorResult.data.vendor;
  const accounts = accountsResult.ok ? accountsResult.data.accounts : [];
  const defaultExpenseAccount = vendor.defaultExpenseAccountId
    ? accounts.find((account) => account.id === vendor.defaultExpenseAccountId)
    : null;
  const payments = paymentsResult.ok ? paymentsResult.data.payments : [];
  const currentYear = new Date().getUTCFullYear();
  const currentYearPayments = payments.filter(
    (payment) => payment.status === "posted" && new Date(payment.paymentDate).getUTCFullYear() === currentYear
  );
  const currentYearPaidCents = currentYearPayments.reduce((total, payment) => total + payment.amountCents, 0);
  const hasTaxId = Boolean(vendor.taxId);
  const applicable1099 = vendor.is1099Vendor;
  const ready1099 = !applicable1099 || hasTaxId;
  const agingVendor = agingResult.ok ? agingResult.data.report.vendors.find((item) => item.vendorId === vendor.id) : null;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    vendor: {
      ...vendor,
      tone: activeTone(vendor.active),
      created: relativeTime(vendor.createdAt),
      updated: relativeTime(vendor.updatedAt),
      defaultExpenseAccountLabel: defaultExpenseAccount
        ? `${defaultExpenseAccount.code} - ${defaultExpenseAccount.name}`
        : vendor.defaultExpenseAccountId ?? "-",
      termsLabel: `${vendor.defaultPaymentTermsDays} days`,
      taxIdStatus: hasTaxId ? "On file" : "Missing",
      addressLines: [vendor.addressLine1, vendor.city, vendor.state, vendor.postalCode, vendor.country].filter(Boolean)
    },
    expenseAccounts: accounts.filter((account) => account.type === "expense" && !account.isHeader && account.active),
    aging: {
      current: money(agingVendor?.currentCents ?? 0, vendor.currency),
      days1To30: money(agingVendor?.days1To30Cents ?? 0, vendor.currency),
      days31To60: money(agingVendor?.days31To60Cents ?? 0, vendor.currency),
      days61To90: money(agingVendor?.days61To90Cents ?? 0, vendor.currency),
      days90Plus: money(agingVendor?.days90PlusCents ?? 0, vendor.currency),
      total: money(agingVendor?.totalCents ?? 0, vendor.currency)
    },
    taxSummary: {
      year: currentYear,
      applicable: applicable1099,
      ready: ready1099,
      tone: readinessTone(ready1099, applicable1099),
      paidThisYear: money(currentYearPaidCents, vendor.currency),
      paymentCount: currentYearPayments.length,
      label: !applicable1099 ? "Not marked for 1099" : ready1099 ? "Ready for review" : "Tax ID required"
    },
    bills: billsResult.ok
      ? billsResult.data.bills.map((bill) => ({
          ...bill,
          tone: billTone(bill.status),
          billDateShort: shortDate(bill.billDate),
          dueDateShort: shortDate(bill.dueDate),
          total: money(bill.totalCents, bill.currency),
          due: money(bill.amountDueCents, bill.currency)
        }))
      : [],
    payments: payments.map((payment) => ({
      ...payment,
      tone: paymentTone(payment.status),
      paymentDateShort: shortDate(payment.paymentDate),
      amount: money(payment.amountCents, payment.currency),
      appliedCount: payment.applications.length
    })),
    recurringBillTemplates: recurringResult.ok
      ? recurringResult.data.templates.map((template) => ({
          ...template,
          tone: recurringTone(template.status),
          nextBillDateShort: shortDate(template.nextBillDate),
          total: money(template.totalCents, template.currency)
        }))
      : []
  };
};

export const actions: Actions = {
  updateVendor: async ({ request, params, locals, cookies, platform }) => {
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

    const result = await updateVendor(
      {
        tenantId: org.id,
        vendorId: params.id,
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        addressLine1: values.addressLine1 || null,
        city: values.city || null,
        state: values.state || null,
        postalCode: values.postalCode || null,
        country: values.country || null,
        taxId: values.taxId || null,
        is1099Vendor: values.is1099Vendor,
        currency: values.currency,
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
        eventName: "accounts-payable.vendor_updated",
        actorId: locals.user.id,
        entityType: "vendor",
        entityId: result.data.vendor.id,
        source: "app/payables/vendors",
        payload: { name: result.data.vendor.name }
      },
      { auditStore: locals.auditStore }
    );

    return { vendorUpdated: true };
  },

  updateVendorStatus: async ({ request, params, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const active = text(form.get("active")) === "true";
    const result = await updateVendorStatus(
      { tenantId: org.id, vendorId: params.id, active },
      {
        accountsPayableStore: locals.accountsPayableStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "accounts-payable.vendor_status_updated",
        actorId: locals.user.id,
        entityType: "vendor",
        entityId: result.data.vendor.id,
        source: "app/payables/vendors",
        payload: { active: result.data.vendor.active }
      },
      { auditStore: locals.auditStore }
    );

    return { vendorStatusUpdated: true };
  }
};
