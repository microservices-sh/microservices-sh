import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getAgingReport, listVendors } from "@microservices-sh/accounts-payable";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function reportDay(value: string | null): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 10);
}

function reportIso(day: string): string {
  return `${day}T00:00:00.000Z`;
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
  requireModule("customer", platform);

  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const asOfDay = reportDay(url.searchParams.get("asOf"));
  const asOfIso = reportIso(asOfDay);
  const customerId = url.searchParams.get("customerId")?.trim() || null;
  const ctx = { tenantId: activeOrgId, actorId: locals.user.id, now: asOfIso };

  const [apAging, arAging, openReceivables, customers, vendors] = await Promise.all([
    getAgingReport({ tenantId: activeOrgId, asOfDate: asOfIso }, { accountsPayableStore: locals.accountsPayableStore }),
    locals.accountsReceivableService.getReceivableAging(ctx, asOfIso),
    locals.accountsReceivableService.listOpenReceivables(ctx),
    listCustomers({ customerRepository: locals.customerRepository }),
    listVendors({ tenantId: activeOrgId, includeInactive: true, limit: 500 }, { accountsPayableStore: locals.accountsPayableStore })
  ]);

  const customerNameById = new Map((customers.ok ? customers.data.customers : []).map((customer) => [customer.id, customer.name]));
  const vendorNameById = new Map((vendors.ok ? vendors.data.vendors : []).map((vendor) => [vendor.id, vendor.name]));
  const statement = customerId
    ? await locals.accountsReceivableService.generateCustomerStatement(ctx, customerId, asOfIso)
    : null;

  return {
    asOfDay,
    selectedCustomerId: customerId,
    customers: customers.ok
      ? customers.data.customers.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email }))
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
      : null
  };
};
