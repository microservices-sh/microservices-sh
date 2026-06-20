import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getTicket, updateTicket } from "@microservices-sh/support-ticket";
import { listCustomers } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

// Ticket status -> Badge tone. open = warn, pending = neutral, resolved/closed = good.
const statusTone = (s: string): Tone =>
  s === "open" ? "warn" : s === "resolved" || s === "closed" ? "good" : "neutral";

// Priority -> Badge tone. urgent/high lean bad/warn, normal/low stay neutral.
const priorityTone = (p: string): Tone =>
  p === "urgent" ? "bad" : p === "high" ? "warn" : "neutral";

const eventTone = (e: string): Tone => {
  if (e.includes("resolved") || e.includes("closed")) return "good";
  if (e.includes("created") || e.includes("status")) return "info";
  if (e.includes("failed")) return "bad";
  return "neutral";
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" }
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("support-ticket", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view a ticket.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const [ticketResult, eventsResult] = await Promise.all([
    getTicket({ id: params.id }, { store: locals.ticketStore }),
    listEvents({ entityType: "support-ticket", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);

  // getTicket isn't tenant-scoped — re-check the tenant the same way the update path does.
  if (!ticketResult.ok || !ticketResult.data || ticketResult.data.ticket.tenantId !== activeOrgId) {
    throw error(404, "Ticket not found");
  }
  const ticket = ticketResult.data.ticket;

  // If the requester is a known customer, link to their record (single-company book).
  const customersResult = await listCustomers({ customerRepository: locals.customerRepository });
  const customer = customersResult.data.customers.find(
    (c) => c.email.toLowerCase() === ticket.requesterEmail.toLowerCase()
  );

  const events = eventsResult.ok ? eventsResult.data.events : [];

  return {
    canManage,
    statusOptions: STATUS_OPTIONS,
    priorityOptions: PRIORITY_OPTIONS,
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      statusTone: statusTone(ticket.status),
      priority: ticket.priority,
      priorityTone: priorityTone(ticket.priority),
      requesterEmail: ticket.requesterEmail,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      created: relativeTime(ticket.createdAt, now)
    },
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  // Change this ticket's status and/or priority. Moved here from the list page so
  // the inline create form stays trivial. member.manage gate, same recordEvent.
  updateTicket: async ({ request, params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    // Write gate: changing a ticket requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const id = params.id;
    const form = await request.formData();
    const status = String(form.get("status") ?? "").trim();
    const priority = String(form.get("priority") ?? "").trim();

    if (!status || !priority) {
      return fail(400, { error: "Pick a status and a priority." });
    }

    const existing = await getTicket({ id }, { store: locals.ticketStore });
    if (!existing.ok || !existing.data || existing.data.ticket.tenantId !== activeOrgId) {
      return fail(404, { error: "Ticket not found for this company." });
    }

    const result = await updateTicket({ id, status, priority }, { store: locals.ticketStore });
    if (!result.ok || !result.data) {
      return fail(400, { error: "Could not update the ticket." });
    }

    await recordEvent(
      {
        eventName: "support-ticket.status_changed",
        actorId: locals.user.id,
        entityType: "support-ticket",
        entityId: result.data.ticket.id,
        source: "app/support/detail",
        payload: { status: result.data.ticket.status, priority: result.data.ticket.priority }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, updated: true };
  }
};
