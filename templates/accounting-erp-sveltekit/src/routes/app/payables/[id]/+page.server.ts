import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { getBill, listBillPayments, listVendors, voidBill } from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { createAccountsPayableAccountingPoster } from "$lib/server/accounts-payable-accounting";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "paid" ? "good" : status === "void" ? "bad" : status === "draft" ? "neutral" : "warn";

const accountingTone = (status: string): Tone => (status === "posted" ? "good" : "warn");

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [billResult, paymentsResult, vendorsResult, accountsResult] = await Promise.all([
    getBill({ tenantId: activeOrgId, billId: params.id }, { accountsPayableStore: locals.accountsPayableStore }),
    listBillPayments(
      { tenantId: activeOrgId, billId: params.id, limit: 50 },
      { accountsPayableStore: locals.accountsPayableStore }
    ),
    listVendors(
      { tenantId: activeOrgId, includeInactive: true, limit: 250 },
      { accountsPayableStore: locals.accountsPayableStore }
    ),
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore })
  ]);
  if (!billResult.ok || !billResult.data) throw error(billResult.status, billResult.error.message);

  const bill = billResult.data.bill;
  const vendor = vendorsResult.ok ? vendorsResult.data.vendors.find((item) => item.id === bill.vendorId) : null;
  const accounts = accountsResult.ok ? accountsResult.data.accounts : [];
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const accountLabel = (accountId: string | null) => {
    const account = accountId ? accountById.get(accountId) : null;
    return account ? `${account.code} - ${account.name}` : accountId ?? "-";
  };
  const paymentHistory = paymentsResult.ok
    ? paymentsResult.data.payments.map((payment) => {
        const application = payment.applications.find((item) => item.billId === bill.id);
        return {
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          paymentDateShort: shortDate(payment.paymentDate),
          amount: money(application?.amountAppliedCents ?? 0, payment.currency),
          method: payment.paymentMethod ?? "-",
          referenceNumber: payment.referenceNumber ?? "-",
          status: payment.status,
          journalEntryId: payment.journalEntryId ?? "-"
        };
      })
    : [];

  return {
    bill: {
      ...bill,
      vendorName: vendor?.name ?? bill.vendorId,
      statusTone: statusTone(bill.status),
      accountingTone: accountingTone(bill.accountingStatus),
      defaultReversalDate: new Date().toISOString().slice(0, 10),
      billDateShort: shortDate(bill.billDate),
      dueDateShort: shortDate(bill.dueDate),
      paidAtShort: shortDate(bill.paidAt),
      created: relativeTime(bill.createdAt),
      updated: relativeTime(bill.updatedAt),
      subtotal: money(bill.subtotalCents, bill.currency),
      tax: money(bill.taxCents, bill.currency),
      total: money(bill.totalCents, bill.currency),
      paid: money(bill.amountPaidCents, bill.currency),
      due: money(bill.amountDueCents, bill.currency),
      apAccountLabel: accountLabel(bill.apAccountId),
      lineItems: bill.lineItems.map((line) => ({
        ...line,
        expenseAccountLabel: accountLabel(line.expenseAccountId),
        unit: money(line.unitAmountCents, bill.currency),
        tax: money(line.taxCents, bill.currency),
        total: money(line.totalCents, bill.currency)
      }))
    },
    paymentHistory
  };
};

export const actions: Actions = {
  voidBill: async ({ request, params, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      reason: text(form.get("reason")),
      reversalDate: text(form.get("reversalDate"))
    };
    const actor = { id: locals.user.id, email: locals.user.email, permissions };
    const result = await voidBill(
      {
        tenantId: org.id,
        billId: params.id,
        reason: values.reason || null,
        reversalDate: values.reversalDate || null,
        voidedById: locals.user.id
      },
      {
        accountsPayableStore: locals.accountsPayableStore,
        accountingPoster: createAccountsPayableAccountingPoster({ accountingCoreStore: locals.accountingCoreStore, actor }),
        actor
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounts-payable.bill_voided",
        actorId: locals.user.id,
        entityType: "bill",
        entityId: result.data.bill.id,
        source: "app/payables/bill",
        payload: { reason: result.data.bill.voidReason, reversalEntryId: result.data.reversalEntryId }
      },
      { auditStore: locals.auditStore }
    );

    return { billVoided: true };
  }
};
