import type { PageServerLoad } from "./$types";
import { listMembers } from "@microservices-sh/org-team-rbac";
import { listCustomers } from "@microservices-sh/customer";
import { listInvoices } from "@microservices-sh/invoice";

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) {
    return { onboarding: true as const };
  }

  // Company-scoped operational summary. Membership is gated in the /app layout;
  // every list is a thin adapter over a module use case.
  const [members, customers, invoices] = await Promise.all([
    listMembers(activeOrgId, { store: locals.rbacStore }),
    listCustomers({ customerRepository: locals.customerRepository }),
    listInvoices({ tenantId: "demo-company" }, { invoiceStore: locals.invoiceStore })
  ]);

  const invoiceList = invoices.ok ? invoices.data.invoices : [];
  const openInvoices = invoiceList.filter((invoice) => invoice.status === "open");
  const outstandingCents = openInvoices.reduce(
    (total, invoice) => total + (invoice.totalCents - invoice.amountPaidCents),
    0
  );

  return {
    onboarding: false as const,
    memberCount: members.data.count,
    customerCount: customers.data.customers.length,
    invoiceCount: invoiceList.length,
    openInvoiceCount: openInvoices.length,
    outstandingCents,
    currency: invoiceList[0]?.currency ?? "USD"
  };
};
