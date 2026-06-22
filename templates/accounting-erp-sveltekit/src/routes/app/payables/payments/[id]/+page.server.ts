import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getBillPayment, getVendor, listBills } from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone => (status === "posted" ? "good" : "bad");

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
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
