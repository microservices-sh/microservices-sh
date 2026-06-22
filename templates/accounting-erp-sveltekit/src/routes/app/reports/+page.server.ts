import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import {
  getBalanceSheet,
  getCashFlowStatement,
  getGeneralLedger,
  getIncomeStatement,
  listAccounts
} from "@microservices-sh/accounting-core";
import { getAgingReport, listVendors } from "@microservices-sh/accounts-payable";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function reportDay(value: string | null): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 10);
}

function optionalDay(value: string | null): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : null;
}

function reportIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function yearStart(day: string): string {
  return `${day.slice(0, 4)}-01-01`;
}

function overdueTotal(input: {
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
}): number {
  return input.days1To30Cents + input.days31To60Cents + input.days61To90Cents + input.days90PlusCents;
}

function daysOverdue(dueDate: string, asOfDay: string): number {
  return Math.max(0, Math.floor((Date.parse(asOfDay) - Date.parse(dueDate)) / 86_400_000));
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("accounts-payable", platform);
  requireModule("accounts-receivable", platform);
  requireModule("accounting-core", platform);
  requireModule("customer", platform);

  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const asOfDay = reportDay(url.searchParams.get("asOf"));
  const startDate = optionalDay(url.searchParams.get("startDate"));
  const statementStartDate = startDate ?? yearStart(asOfDay);
  const asOfIso = reportIso(asOfDay);
  const customerId = url.searchParams.get("customerId")?.trim() || null;
  const accountId = url.searchParams.get("accountId")?.trim() || null;
  const ctx = { tenantId: activeOrgId, actorId: locals.user.id, now: asOfIso };

  const [apAging, arAging, openReceivables, customers, vendors, accounts, incomeStatement, balanceSheet, cashFlowStatement] = await Promise.all([
    getAgingReport({ tenantId: activeOrgId, asOfDate: asOfIso }, { accountsPayableStore: locals.accountsPayableStore }),
    locals.accountsReceivableService.getReceivableAging(ctx, asOfIso),
    locals.accountsReceivableService.listOpenReceivables(ctx),
    listCustomers({ customerRepository: locals.customerRepository }),
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore }),
    listAccounts({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountingCoreStore: locals.accountingCoreStore }),
    getIncomeStatement(
      { tenantId: activeOrgId, startDate: statementStartDate, endDate: asOfDay },
      { accountingCoreStore: locals.accountingCoreStore }
    ),
    getBalanceSheet({ tenantId: activeOrgId, asOfDate: asOfDay }, { accountingCoreStore: locals.accountingCoreStore }),
    getCashFlowStatement(
      { tenantId: activeOrgId, startDate: statementStartDate, endDate: asOfDay },
      { accountingCoreStore: locals.accountingCoreStore }
    )
  ]);

  const customerNameById = new Map((customers.ok ? customers.data.customers : []).map((customer) => [customer.id, customer.name]));
  const vendorNameById = new Map((vendors.ok ? vendors.data.vendors : []).map((vendor) => [vendor.id, vendor.name]));
  const statement = customerId
    ? await locals.accountsReceivableService.generateCustomerStatement(ctx, customerId, asOfIso)
    : null;
  const generalLedger = accountId
    ? await getGeneralLedger(
        {
          tenantId: activeOrgId,
          accountId,
          startDate: startDate ?? undefined,
          endDate: asOfDay,
          includeOpeningBalance: Boolean(startDate)
        },
        { accountingCoreStore: locals.accountingCoreStore }
      )
    : null;

  return {
    asOfDay,
    startDate,
    statementStartDate,
    selectedCustomerId: customerId,
    selectedAccountId: accountId,
    customers: customers.ok
      ? customers.data.customers.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email }))
      : [],
    accounts: accounts.ok
      ? accounts.data.accounts.map((account) => ({ id: account.id, code: account.code, name: account.name, type: account.type }))
      : [],
    apAging: apAging.ok
      ? {
          ...apAging.data.report,
          overdueCents: overdueTotal(apAging.data.report.totals),
          vendors: apAging.data.report.vendors.map((vendor) => ({
            ...vendor,
            vendorName: vendorNameById.get(vendor.vendorId) ?? vendor.vendorId
          }))
        }
      : null,
    arAging: arAging.ok
      ? {
          ...arAging.data,
          overdueCents: overdueTotal(arAging.data)
        }
      : null,
    openReceivables: openReceivables.ok
      ? openReceivables.data.map((invoice) => ({
          ...invoice,
          customerName: customerNameById.get(invoice.customerId) ?? invoice.customerId,
          daysOverdue: daysOverdue(invoice.dueDate, asOfIso)
        }))
      : [],
    statement: statement?.ok
      ? {
          ...statement.data,
          customerName: customerNameById.get(statement.data.customerId) ?? statement.data.customerId
        }
      : null,
    generalLedger: generalLedger?.ok ? generalLedger.data.generalLedger : null,
    incomeStatement: incomeStatement.ok ? incomeStatement.data.incomeStatement : null,
    balanceSheet: balanceSheet.ok ? balanceSheet.data.balanceSheet : null,
    cashFlowStatement: cashFlowStatement.ok ? cashFlowStatement.data.cashFlowStatement : null
  };
};
