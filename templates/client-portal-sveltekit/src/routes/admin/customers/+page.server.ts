import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import { listInvoicesScoped, authContext } from "@microservices-sh/invoice";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== "staff") {
    throw redirect(303, "/login");
  }

  // Enforced boundary (plan 33): tenant from the server-resolved session.
  const ctx = authContext({ orgId: locals.tenantId, actorId: locals.user.id, roles: ["staff"] });
  const [customersResult, invoicesResult] = await Promise.all([
    listCustomers({ customerRepository: locals.customerRepository }),
    listInvoicesScoped(ctx, {}, { invoiceStore: locals.invoiceStore })
  ]);

  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];

  const customers = customersResult.data.customers.map((customer) => {
    const own = invoices.filter((invoice) => invoice.customerId === customer.id);
    const outstandingCents = own
      .filter((invoice) => invoice.status === "open")
      .reduce((total, invoice) => total + (invoice.totalCents - invoice.amountPaidCents), 0);
    return {
      ...customer,
      invoiceCount: own.length,
      outstandingCents,
      currency: own[0]?.currency ?? "USD"
    };
  });

  return { customers };
};
