import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoices } from "@microservices-sh/invoice";
import { listFiles } from "@microservices-sh/file-media";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  const [invoicesResult, filesResult] = await Promise.all([
    // Customer-scoped: a customer only ever sees invoices for their own id.
    listInvoices(
      { tenantId: locals.tenantId, customerId: user.customerId },
      { invoiceStore: locals.invoiceStore }
    ),
    listFiles({ tenantId: locals.tenantId, ownerId: user.customerId, status: "active" }, { mediaStore: locals.mediaStore })
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
