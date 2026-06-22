import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getBill, listVendors } from "@microservices-sh/accounts-payable";
import { listAccounts } from "@microservices-sh/accounting-core";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "paid" ? "good" : status === "void" ? "bad" : status === "draft" ? "neutral" : "warn";

const accountingTone = (status: string): Tone => (status === "posted" ? "good" : "warn");

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [billResult, vendorsResult, accountsResult] = await Promise.all([
    getBill({ tenantId: activeOrgId, billId: params.id }, { accountsPayableStore: locals.accountsPayableStore }),
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

  return {
    bill: {
      ...bill,
      vendorName: vendor?.name ?? bill.vendorId,
      statusTone: statusTone(bill.status),
      accountingTone: accountingTone(bill.accountingStatus),
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
    }
  };
};
