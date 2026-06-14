import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  const invoice = await locals.invoiceStore.get(params.id);
  // Fold the tenant/owner check into the 404 so existence never leaks across
  // customers — a customer can only open their own invoices.
  if (!invoice || invoice.tenantId !== locals.tenantId || invoice.customerId !== user.customerId) {
    throw error(404, "Invoice not found");
  }

  const lineItems = await locals.invoiceStore.listLineItems(invoice.id);
  return { invoice, lineItems };
};
