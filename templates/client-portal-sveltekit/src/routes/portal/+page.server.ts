import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoicesScoped, authContext } from "@microservices-sh/invoice";
import { listFilesScoped } from "@microservices-sh/file-media";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  // Enforced boundary (plan 33): the tenant comes from the session (locals.tenantId).
  // Within that tenant, customerId/ownerId narrows to the signed-in customer's own
  // records — both come from the resolved session, never from request input.
  const ctx = authContext({ orgId: locals.tenantId, actorId: user.id, roles: ["customer"] });
  const [invoicesResult, filesResult] = await Promise.all([
    listInvoicesScoped(ctx, { customerId: user.customerId }, { invoiceStore: locals.invoiceStore }),
    listFilesScoped(ctx, { ownerId: user.customerId, status: "active" }, { mediaStore: locals.mediaStore })
  ]);

  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];
  const files = filesResult.ok ? filesResult.data.files : [];

  const outstandingCents = invoices
    .filter((invoice) => invoice.status === "open")
    .reduce((total, invoice) => total + (invoice.totalCents - invoice.amountPaidCents), 0);

  return {
    email: user.email,
    currency: invoices[0]?.currency ?? "USD",
    invoices: invoices.slice(0, 5),
    files: files.slice(0, 5),
    counts: {
      invoices: invoices.length,
      openInvoices: invoices.filter((invoice) => invoice.status === "open").length,
      files: files.length
    },
    outstandingCents
  };
};
