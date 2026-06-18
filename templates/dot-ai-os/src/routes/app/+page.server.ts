import type { PageServerLoad } from "./$types";
import { listMembers } from "@microservices-sh/org-team-rbac";
import { listCustomers } from "@microservices-sh/customer";
import { listInvoices } from "@microservices-sh/invoice";
import { getOperatorWorkbench } from "@microservices-sh/operator-work";

export const load: PageServerLoad = async ({ locals, parent }) => {
  // The /app layout guarantees a signed-in user with an active operator workspace org —
  // it redirects to /login (no session) or /signup (no workspace) otherwise.
  const { activeOrgId } = await parent();
  const today = new Date().toISOString().slice(0, 10);

  // Workspace-scoped operational summary. Membership is gated in the /app layout;
  // every list is a thin adapter over a module use case.
  const [members, customers, invoices, operatorWorkbench] = await Promise.all([
    listMembers(activeOrgId, { store: locals.rbacStore }),
    listCustomers({ customerRepository: locals.customerRepository }),
    listInvoices({ tenantId: activeOrgId }, { invoiceStore: locals.invoiceStore }),
    getOperatorWorkbench({ orgId: activeOrgId, date: today }, { store: locals.operatorWorkStore })
  ]);

  const invoiceList = invoices.ok ? invoices.data.invoices : [];
  const openInvoices = invoiceList.filter((invoice) => invoice.status === "open");
  const outstandingCents = openInvoices.reduce(
    (total, invoice) => total + (invoice.totalCents - invoice.amountPaidCents),
    0
  );

  return {
    memberCount: members.data.count,
    customerCount: customers.data.customers.length,
    invoiceCount: invoiceList.length,
    openInvoiceCount: openInvoices.length,
    outstandingCents,
    currency: invoiceList[0]?.currency ?? "USD",
    operator: operatorWorkbench.ok
      ? operatorWorkbench.data
      : {
          tasks: [],
          focusBlocks: [],
          reviews: [],
          summary: {
            openTaskCount: 0,
            highPriorityTaskCount: 0,
            focusBlockCount: 0,
            savedReviewCount: 0,
            latestReview: null
          }
        }
  };
};
