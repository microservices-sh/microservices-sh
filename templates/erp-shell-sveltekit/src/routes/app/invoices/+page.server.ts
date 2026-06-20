import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoices } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: org.read lets an employee view the invoice ledger.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Invoices are scoped to the single company org; its id is the tenant. The
  // ledger is read-only here — creating happens at /app/invoices/new, and
  // recording payments happens on the invoice detail page (/app/invoices/[id]).
  const [invoicesResult, customersResult] = await Promise.all([
    listInvoices({ tenantId: activeOrgId }, { invoiceStore: locals.invoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const nameById = new Map(customersResult.data.customers.map((customer) => [customer.id, customer.name]));
  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? "—",
      status: invoice.status,
      customerId: invoice.customerId,
      customer: nameById.get(invoice.customerId) ?? invoice.customerId,
      currency: invoice.currency,
      totalCents: invoice.totalCents
    }))
  };
};
