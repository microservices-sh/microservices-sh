import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { createInvoicePaymentLinkScoped, getInvoiceScoped, recordPaymentScoped, voidInvoiceScoped, authContext } from "@microservices-sh/invoice";
import type { AuthContext } from "@microservices-sh/invoice";
import { sendEmail } from "@microservices-sh/email";
import { getCustomer } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { notify } from "@microservices-sh/notifications-inapp";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import { buildInvoiceEmail } from "$lib/server/invoice-email";
import { syncInvoiceToReceivables } from "$lib/server/accounts-receivable-sync";
import type { Tone } from "$lib/ui/types";

const statusTone = (s: string): Tone =>
  s === "paid" ? "good" : s === "open" ? "warn" : s === "void" ? "bad" : "neutral";

const eventTone = (e: string): Tone => {
  if (e.includes("payment")) return "good";
  if (e.includes("issued") || e.includes("created")) return "info";
  if (e.includes("void") || e.includes("failed")) return "bad";
  return "neutral";
};

// Enforced boundary (plan 33): resolve one invoice by id within the session org.
// getInvoiceScoped returns 404 for a foreign id, replacing the old list-then-find
// tenant scan.
async function findInvoice(ctx: AuthContext, id: string, store: App.Locals["invoiceStore"]) {
  const res = await getInvoiceScoped(ctx, id, { invoiceStore: store });
  return res.ok && res.data ? res.data.invoice : undefined;
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("invoice", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const [invoice, eventsResult] = await Promise.all([
    findInvoice(ctx, params.id, locals.invoiceStore),
    listEvents({ entityType: "invoice", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);
  if (!invoice) throw error(404, "Invoice not found");

  const cust = await getCustomer({ id: invoice.customerId }, { customerRepository: locals.customerRepository });
  const customerName = cust.ok && cust.data ? cust.data.customer.name : invoice.customerId;
  const customer = cust.ok && cust.data ? cust.data.customer : null;
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
      isVoidable: invoice.status === "open",
      totalCents: invoice.totalCents,
      paymentLinkUrl: invoice.paymentLinkUrl,
      paymentLinkProvider: invoice.paymentLinkProvider,
      issued: invoice.issuedAt ? relativeTime(invoice.issuedAt, now) : null,
      due: invoice.dueAt ? relativeTime(invoice.dueAt, now) : null,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt ? relativeTime(invoice.paidAt, now) : null,
      customer: {
        name: customer?.name ?? customerName,
        email: customer?.email ?? null,
        phone: customer?.phone ?? null
      }
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
  payment: async ({ request, params, locals, cookies, platform }) => {
    requireModule("accounts-receivable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });

    const invoiceId = params.id;
    const form = await request.formData();
    const amount = Number(form.get("amount"));
    const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    if (amountCents <= 0) return fail(400, { error: "Enter a payment amount greater than zero." });
    const currentInvoice = await findInvoice(ctx, invoiceId, locals.invoiceStore);
    if (!currentInvoice || currentInvoice.status !== "open") {
      return fail(409, { error: "Only open invoices can receive payments." });
    }
    const currentOutstandingCents = Math.max(0, currentInvoice.totalCents - currentInvoice.amountPaidCents);
    if (amountCents > currentOutstandingCents) {
      return fail(400, { error: "Payment exceeds the invoice open balance." });
    }

    // Enforced boundary (plan 33): recordPaymentScoped checks ownership against
    // the session org before applying the payment — a cross-tenant write is 404.
    const result = await recordPaymentScoped(ctx, { invoiceId, amountCents }, { invoiceStore: locals.invoiceStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not record the payment." });
    }

    const paid = result.data.status === "paid";
    const invoice = await findInvoice(ctx, invoiceId, locals.invoiceStore);
    let syncWarning: string | null = null;
    if (invoice) {
      const synced = await syncInvoiceToReceivables({
        accountsReceivableService: locals.accountsReceivableService,
        tenantId: activeOrgId,
        actorId: locals.user.id,
        invoice
      });
      if (!synced.ok) syncWarning = synced.message;
    }

    await recordEvent(
      {
        eventName: "invoice.payment_recorded",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices/detail",
        payload: {
          amountCents,
          status: result.data.status,
          receivablesSynced: syncWarning === null,
          receivablesSyncError: syncWarning
        }
      },
      { auditStore: locals.auditStore }
    );

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

    return { ok: true, paymentRecorded: true, paid, syncWarning };
  },

  paymentLink: async ({ params, locals, cookies, platform }) => {
    requireModule("invoice", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });
    const invoiceId = params.id;
    const invoice = await findInvoice(ctx, invoiceId, locals.invoiceStore);
    if (!invoice) return fail(404, { error: "Invoice not found." });

    const customer = await getCustomer({ id: invoice.customerId }, { customerRepository: locals.customerRepository });
    const result = await createInvoicePaymentLinkScoped(
      ctx,
      { invoiceId, customerEmail: customer.ok && customer.data ? customer.data.customer.email || undefined : undefined },
      { invoiceStore: locals.invoiceStore, paymentLinkProvider: locals.invoicePaymentLinkProvider }
    );
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not create the payment link." });
    }

    await recordEvent(
      {
        eventName: "invoice.payment_link_created",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices/detail",
        payload: { provider: result.data.provider, idempotent: result.data.idempotent }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, paymentLinkCreated: true, paymentLinkUrl: result.data.paymentLinkUrl };
  },

  sendInvoice: async ({ params, locals, cookies, platform }) => {
    requireModule("invoice", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });
    const invoiceId = params.id;
    const invoice = await findInvoice(ctx, invoiceId, locals.invoiceStore);
    if (!invoice) return fail(404, { error: "Invoice not found." });

    const customer = await getCustomer({ id: invoice.customerId }, { customerRepository: locals.customerRepository });
    if (!customer.ok || !customer.data) return fail(customer.status ?? 404, { error: customer.error?.message ?? "Customer not found." });
    const recipient = customer.data.customer.email;
    if (!recipient) return fail(400, { error: "Customer needs an email address before sending this invoice." });

    const link = await createInvoicePaymentLinkScoped(
      ctx,
      { invoiceId, customerEmail: recipient },
      { invoiceStore: locals.invoiceStore, paymentLinkProvider: locals.invoicePaymentLinkProvider }
    );
    if (!link.ok || !link.data) {
      return fail(link.status ?? 400, { error: link.error?.message ?? "Could not create the payment link." });
    }

    const outstandingCents = Math.max(0, invoice.totalCents - invoice.amountPaidCents);
    const email = buildInvoiceEmail({
      invoiceNumber: invoice.number ?? invoice.id,
      customerName: customer.data.customer.name,
      totalCents: invoice.totalCents,
      outstandingCents,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      paymentLinkUrl: link.data.paymentLinkUrl,
      companyName: org.name
    });
    const sent = await sendEmail(
      {
        from: locals.emailFrom,
        to: [recipient],
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: `invoice-send:${invoice.id}:${link.data.paymentLinkId}`,
        tags: [
          { name: "module", value: "invoice" },
          { name: "template", value: "accounting-erp-sveltekit" }
        ],
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          paymentLinkId: link.data.paymentLinkId,
          paymentLinkProvider: link.data.provider
        }
      },
      {
        provider: locals.emailProvider,
        emailRepository: locals.emailRepository,
        actor: { id: locals.user.id, email: locals.user.email }
      }
    );
    if (!sent.ok || !sent.data) {
      return fail(sent.status ?? 400, { error: sent.error?.message ?? "Could not send the invoice email." });
    }

    await recordEvent(
      {
        eventName: "invoice.sent",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices/detail",
        payload: {
          to: recipient,
          emailDeliveryId: sent.data.delivery.id,
          paymentLinkId: link.data.paymentLinkId,
          paymentLinkProvider: link.data.provider,
          paymentLinkIdempotent: link.data.idempotent
        }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, invoiceSent: true, paymentLinkUrl: link.data.paymentLinkUrl, recipient };
  },

  void: async ({ params, locals, cookies, platform }) => {
    requireModule("accounts-receivable", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
    const invoiceId = params.id;

    const result = await voidInvoiceScoped(ctx, invoiceId, { invoiceStore: locals.invoiceStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not void the invoice." });
    }

    const invoice = await findInvoice(ctx, invoiceId, locals.invoiceStore);
    let syncWarning: string | null = null;
    if (invoice) {
      const synced = await syncInvoiceToReceivables({
        accountsReceivableService: locals.accountsReceivableService,
        tenantId: activeOrgId,
        actorId: locals.user.id,
        invoice
      });
      if (!synced.ok) syncWarning = synced.message;
    }

    await recordEvent(
      {
        eventName: "invoice.voided",
        actorId: locals.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        source: "app/invoices/detail",
        payload: {
          status: result.data.status,
          receivablesSynced: syncWarning === null,
          receivablesSyncError: syncWarning
        }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, invoiceVoided: true, syncWarning };
  }
};
