import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoices } from "@microservices-sh/invoice";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  const result = await listInvoices(
    { tenantId: locals.tenantId, customerId: user.customerId },
    { invoiceStore: locals.invoiceStore }
  );

  return {
    invoices: result.ok ? result.data.invoices : []
  };
};
