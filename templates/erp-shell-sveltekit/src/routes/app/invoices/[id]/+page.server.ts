import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { listInvoices, recordPayment } from "@microservices-sh/invoice";
import { getCustomer } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { notify } from "@microservices-sh/notifications-inapp";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const statusTone = (s: string): Tone =>
  s === "paid" ? "good" : s === "open" ? "warn" : s === "void" ? "bad" : "neutral";

const eventTone = (e: string): Tone => {
  if (e.includes("payment")) return "good";
  if (e.includes("issued") || e.includes("created")) return "info";
  if (e.includes("void") || e.includes("failed")) return "bad";
  return "neutral";
};

// There's no single-invoice use case (only listInvoices), so resolve by id from
// the tenant's list — same read path the ledger uses.
async function findInvoice(tenantId: string, id: string, store: App.Locals["invoiceStore"]) {
  const res = await listInvoices({ tenantId }, { invoiceStore: store });
  return res.ok && res.data ? res.data.invoices.find((i) => i.id === id) : undefined;
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const [invoice, eventsResult] = await Promise.all([
    findInvoice(activeOrgId, params.id, locals.invoiceStore),
    listEvents({ entityType: "invoice", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);
  if (!invoice) throw error(404, "Invoice not found");

  const cust = await getCustomer({ id: invoice.customerId }, { customerRepository: locals.customerRepository });
  const customerName = cust.ok && cust.data ? cust.data.customer.name : invoice.customerId;
  const outstandingCents = invoice.totalCents - invoice.amountPaidCents;
  const overdue = invoice.status === "open" && !!invoice.dueAt && new Date(invoice.dueAt).getTime() < now;
  const events = eventsResult.ok ? eventsResult.data.events : [];

  return {
    canManage,
    invoice: {
      id: invoice.id,
      number: invoice.number ?? "Draft",
      status: invoice.status,
      tone: statusTone(invoice.status),
      overdue,
      isOpen: invoice.status === "open",
      customerId: invoice.customerId,
      customerName,
      currency: invoice.currency,
      subtotal: money(invoice.subtotalCents, invoice.currency),
      tax: money(invoice.taxCents, invoice.currency),
      total: money(invoice.totalCents, invoice.currency),
      paid: money(invoice.amountPaidCents, invoice.currency),
      outstanding: money(outstandingCents, invoice.currency),
      outstandingAmount: (outstandingCents / 100).toFixed(2),
      issued: invoice.issuedAt ? relativeTime(invoice.issuedAt, now) : null,
      due: invoice.dueAt ? relativeTime(invoice.dueAt, now) : null,
      paidAt: invoice.paidAt ? relativeTime(invoice.paidAt, now) : null
    },
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      detail:
        typeof e.payload?.amountCents === "number"
          ? money(e.payload.amountCents as number, invoice.currency)
          : undefined,
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  // Record a payment against this invoice. The module flips status to "paid" once
  // the balance is covered; the cascade then notifies the operator in-app (shows
  // on the dashboard unread panel + notifications inbox).
  payment: async ({ request, params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const invoiceId = params.id;
    const form = await request.formData();
    const amount = Number(form.get("amount"));
    const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    if (amountCents <= 0) return fail(400, { error: "Enter a payment amount greater than zero." });

    const result = await recordPayment({ invoiceId, amountCents }, { invoiceStore: locals.invoiceStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not record the payment." });
    }

    await recordEvent(
      {
        eventName: "invoice.payment_recorded",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices/detail",
        payload: { amountCents, status: result.data.status }
      },
      { auditStore: locals.auditStore }
    );

    const paid = result.data.status === "paid";
    const invoice = await findInvoice(activeOrgId, invoiceId, locals.invoiceStore);
    let customerName = "a customer";
    if (invoice) {
      const cust = await getCustomer({ id: invoice.customerId }, { customerRepository: locals.customerRepository });
      if (cust.ok && cust.data) customerName = cust.data.customer.name;
    }
    await notify(
      {
        userId: locals.user.id,
        type: paid ? "invoice.paid" : "invoice.payment",
        title: paid ? "Invoice paid" : "Payment recorded",
        body: `${money(amountCents, invoice?.currency)} from ${customerName}${
          invoice?.number ? ` · invoice ${invoice.number}` : ""
        }${paid ? " — settled in full." : "."}`,
        data: { invoiceId, customerId: invoice?.customerId ?? null }
      },
      { store: locals.notificationStore }
    );

    return { ok: true, paymentRecorded: true, paid };
  }
};
