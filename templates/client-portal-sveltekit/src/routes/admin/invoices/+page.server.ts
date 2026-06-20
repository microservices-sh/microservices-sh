import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoicesScoped, authContext } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== "staff") {
    throw redirect(303, "/login");
  }

  // Enforced boundary (plan 33): tenant from the server-resolved session.
  const ctx = authContext({ orgId: locals.tenantId, actorId: locals.user.id, roles: ["staff"] });
  const [invoicesResult, customersResult] = await Promise.all([
    listInvoicesScoped(ctx, {}, { invoiceStore: locals.invoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];
  const customerName = new Map(customersResult.data.customers.map((customer) => [customer.id, customer.name]));

  return {
    invoices: invoices.map((invoice) => ({
      ...invoice,
      customerName: customerName.get(invoice.customerId) ?? invoice.customerId
    }))
  };
};
