import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { getBillPayment, getVendor, listBills, voidBillPayment } from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { createAccountsPayableAccountingPoster } from "$lib/server/accounts-payable-accounting";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone => (status === "posted" ? "good" : "bad");

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
  const paymentResult = await getBillPayment(
    { tenantId: activeOrgId, paymentId: params.id },
    { accountsPayableStore: locals.accountsPayableStore }
  );
  if (!paymentResult.ok || !paymentResult.data) throw error(paymentResult.status, paymentResult.error.message);

  const payment = paymentResult.data.payment;
  const [vendorResult, billsResult, accountsResult] = await Promise.all([
    getVendor({ tenantId: activeOrgId, vendorId: payment.vendorId }, { accountsPayableStore: locals.accountsPayableStore }),
    listBills({ tenantId: activeOrgId, vendorId: payment.vendorId, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore }),
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore })
  ]);

  const billById = new Map((billsResult.ok ? billsResult.data.bills : []).map((bill) => [bill.id, bill]));
  const accountById = new Map((accountsResult.ok ? accountsResult.data.accounts : []).map((account) => [account.id, account]));
  const paymentAccount = payment.paymentAccountId ? accountById.get(payment.paymentAccountId) : null;

  return {
    payment: {
      ...payment,
      vendorName: vendorResult.ok ? vendorResult.data.vendor.name : payment.vendorId,
      statusTone: statusTone(payment.status),
      paymentDateShort: shortDate(payment.paymentDate),
      postedAtShort: shortDate(payment.postedAt),
      voidedAtShort: shortDate(payment.voidedAt),
      created: relativeTime(payment.createdAt),
      updated: relativeTime(payment.updatedAt),
      amount: money(payment.amountCents, payment.currency),
      unapplied: money(payment.unappliedAmountCents, payment.currency),
      paymentAccountLabel: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : payment.paymentAccountId ?? "-",
      method: payment.paymentMethod ?? "-",
      referenceNumber: payment.referenceNumber ?? "-",
      journalEntryId: payment.journalEntryId ?? "-",
      canVoid: payment.status === "posted" && Boolean(payment.journalEntryId),
      defaultReversalDate: new Date().toISOString().slice(0, 10),
      applications: payment.applications.map((application) => {
        const bill = billById.get(application.billId);
        return {
          ...application,
          billNumber: bill?.billNumber ?? application.billId,
          billStatus: bill?.status ?? "-",
          billDue: bill ? money(bill.amountDueCents, bill.currency) : "-",
          amount: money(application.amountAppliedCents, payment.currency),
          appliedAtShort: shortDate(application.appliedAt)
        };
      })
    }
  };
};

export const actions: Actions = {
  voidPayment: async ({ request, params, locals, cookies, platform }) => {
    requireModule("accounts-payable", platform);
    requireModule("accounting-core", platform);
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
    const result = await voidBillPayment(
      {
        tenantId: org.id,
        paymentId: params.id,
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
        eventName: "accounts-payable.bill_payment_voided",
        actorId: locals.user.id,
        entityType: "bill_payment",
        entityId: result.data.payment.id,
        source: "app/payables/payment",
        payload: {
          reason: result.data.payment.voidReason,
          reversalEntryId: result.data.reversalEntryId
        }
      },
      { auditStore: locals.auditStore }
    );

    return { paymentVoided: true };
  }
};
