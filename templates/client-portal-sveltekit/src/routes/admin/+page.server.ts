import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listInvoices } from "@microservices-sh/invoice";
import { listCustomers } from "@microservices-sh/customer";
import { listFiles } from "@microservices-sh/file-media";
import { listEvents } from "@microservices-sh/audit-log";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== "staff") {
    throw redirect(303, "/login");
  }

  const [invoicesResult, customersResult, filesResult, eventsResult] = await Promise.all([
    listInvoices({ tenantId: locals.tenantId }, { invoiceStore: locals.invoiceStore }),
    listCustomers({ customerRepository: locals.customerRepository }),
    listFiles({ tenantId: locals.tenantId, status: "active" }, { mediaStore: locals.mediaStore }),
    listEvents({ limit: 8 }, { auditStore: locals.auditStore })
  ]);

  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];
  const customers = customersResult.data.customers;
  const files = filesResult.ok ? filesResult.data.files : [];
  const events = eventsResult.ok ? eventsResult.data.events : [];

  const customerName = new Map(customers.map((customer) => [customer.id, customer.name]));

  const outstandingCents = invoices
    .filter((invoice) => invoice.status === "open")
    .reduce((total, invoice) => total + (invoice.totalCents - invoice.amountPaidCents), 0);

  return {
    counts: {
      invoices: invoices.length,
      customers: customers.length,
      files: files.length
    },
    outstandingCents,
    currency: invoices[0]?.currency ?? "USD",
    recentInvoices: invoices.slice(0, 5).map((invoice) => ({
      ...invoice,
      customerName: customerName.get(invoice.customerId) ?? invoice.customerId
    })),
    events
  };
};
