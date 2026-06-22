import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import {
  getAgingReport,
  getVendor,
  listBillPayments,
  listBills,
  listRecurringBillTemplates
} from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
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

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
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
