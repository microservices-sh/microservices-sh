import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoicesScoped, authContext } from "@microservices-sh/invoice";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  // Enforced boundary (plan 33): tenant from the session; customerId narrows to
  // the signed-in customer's own invoices within that tenant.
  const ctx = authContext({ orgId: locals.tenantId, actorId: user.id, roles: ["customer"] });
  const result = await listInvoicesScoped(
    ctx,
    { customerId: user.customerId },
    { invoiceStore: locals.invoiceStore }
  );

  return {
    invoices: result.ok ? result.data.invoices : []
  };
};
