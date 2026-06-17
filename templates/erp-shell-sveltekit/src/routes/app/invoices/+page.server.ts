import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoices } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";

const TENANT_ID = "demo-company";

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: org.read lets an employee view the invoice ledger.
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [invoicesResult, customersResult] = await Promise.all([
    listInvoices({ tenantId: TENANT_ID }, { invoiceStore: locals.invoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const nameById = new Map(customersResult.data.customers.map((customer) => [customer.id, customer.name]));
  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? "—",
      status: invoice.status,
      customer: nameById.get(invoice.customerId) ?? invoice.customerId,
      currency: invoice.currency,
      totalCents: invoice.totalCents,
      outstandingCents: invoice.totalCents - invoice.amountPaidCents
    }))
  };
};
