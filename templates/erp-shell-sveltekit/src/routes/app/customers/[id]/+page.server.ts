import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getCustomer, upsertCustomer } from "@microservices-sh/customer";
import { listInvoices } from "@microservices-sh/invoice";
import { listFiles } from "@microservices-sh/file-media";
import { listTickets } from "@microservices-sh/support-ticket";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "paid" ? "good" : status === "open" ? "warn" : status === "void" ? "bad" : "neutral";

const ticketTone = (status: string): Tone =>
  status === "resolved" || status === "closed" ? "good" : status === "pending" ? "info" : "warn";

const eventTone = (eventName: string): Tone => {
  if (eventName.includes("payment")) return "good";
  if (eventName.includes("issued") || eventName.includes("created") || eventName.includes("upload")) return "info";
  if (eventName.includes("failed")) return "bad";
  return "neutral";
};

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("customer", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");

  const customerResult = await getCustomer({ id: params.id }, { customerRepository: locals.customerRepository });
  if (!customerResult.ok || !customerResult.data) throw error(404, "Customer not found");
  const customer = customerResult.data.customer;
  const now = Date.now();

  // Cross-module 360: invoices by customerId, files by ownerId, tickets by
  // requester email, history from the audit log scoped to this customer entity.
  const [invoicesResult, filesResult, ticketsResult, eventsResult] = await Promise.all([
    listInvoices({ tenantId: activeOrgId, customerId: customer.id }, { invoiceStore: locals.invoiceStore }),
    listFiles({ tenantId: activeOrgId, ownerId: customer.id }, { mediaStore: locals.mediaStore }),
    listTickets({ tenantId: activeOrgId }, { store: locals.ticketStore }),
    listEvents({ entityType: "customer", entityId: customer.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);

  const invoices = invoicesResult.ok && invoicesResult.data ? invoicesResult.data.invoices : [];
  const files = filesResult.ok && filesResult.data ? filesResult.data.files : [];
  const allTickets = ticketsResult.ok && ticketsResult.data ? ticketsResult.data.tickets : [];
  const events = eventsResult.ok ? eventsResult.data.events : [];

  const tickets = allTickets.filter((t) => t.requesterEmail.toLowerCase() === customer.email.toLowerCase());
  const currency = invoices[0]?.currency ?? "USD";

  const outstandingCents = invoices
    .filter((i) => i.status === "open")
    .reduce((t, i) => t + (i.totalCents - i.amountPaidCents), 0);
  const lifetimeCents = invoices.reduce((t, i) => t + i.amountPaidCents, 0);
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "pending").length;

  return {
    canManage,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes,
      since: relativeTime(customer.createdAt, now)
    },
    summary: {
      outstanding: money(outstandingCents, currency),
      hasOutstanding: outstandingCents > 0,
      lifetime: money(lifetimeCents, currency),
      invoiceCount: invoices.length,
      fileCount: files.length,
      openTickets
    },
    invoices: invoices
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((i) => ({
        id: i.id,
        number: i.number ?? "Draft",
        status: i.status,
        tone: statusTone(i.status),
        total: money(i.totalCents, i.currency),
        balance: money(i.totalCents - i.amountPaidCents, i.currency),
        due: i.dueAt ? relativeTime(i.dueAt, now) : null,
        overdue: i.status === "open" && !!i.dueAt && new Date(i.dueAt).getTime() < now
      })),
    files: files.map((f) => ({
      id: f.id,
      name: f.originalName,
      size: formatBytes(f.bytes),
      uploaded: relativeTime(f.createdAt, now)
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      tone: ticketTone(t.status),
      priority: t.priority,
      age: relativeTime(t.createdAt, now)
    })),
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      detail:
        typeof e.payload?.number === "string"
          ? `Invoice ${e.payload.number}`
          : typeof e.payload?.originalName === "string"
            ? String(e.payload.originalName)
            : undefined,
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  // Edit name/phone in place. Email is read-only: the customer module's
  // upsertCustomer keys on email, so changing it would create a new record
  // rather than rename — we keep the existing email and update the rest.
  update: async ({ request, params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });

    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const existing = await getCustomer({ id: params.id }, { customerRepository: locals.customerRepository });
    if (!existing.ok || !existing.data) return fail(404, { error: "Customer not found." });

    const data = await request.formData();
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim() || null;
    if (!name) return fail(400, { error: "Enter a name." });

    const result = await upsertCustomer(
      { name, email: existing.data.customer.email, phone, notes: existing.data.customer.notes },
      { customerRepository: locals.customerRepository }
    );
    if (!result.ok || !result.data) return fail(400, { error: "Could not save the customer." });

    await recordEvent(
      {
        eventName: "customer.updated",
        actorId: locals.user.id,
        entityType: "customer",
        entityId: params.id,
        source: "app/customers/detail",
        payload: { name }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, updated: true };
  }
};
