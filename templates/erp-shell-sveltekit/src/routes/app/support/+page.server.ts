import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listTickets, createTicket, getTicket, updateTicket } from "@microservices-sh/support-ticket";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("support-ticket", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view the support queue.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const result = await listTickets({ tenantId: activeOrgId }, { store: locals.ticketStore });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    tickets: (result.data?.tickets ?? []).map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail
    }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    // Write gate: opening tickets requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const subject = String(form.get("subject") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const requesterEmail = String(form.get("requesterEmail") ?? "").trim().toLowerCase();
    const priority = String(form.get("priority") ?? "normal").trim();

    if (!subject || !requesterEmail.includes("@")) {
      return fail(400, {
        error: "Enter a subject and a valid requester email.",
        values: { subject, description, requesterEmail, priority }
      });
    }

    const result = await createTicket(
      { tenantId: activeOrgId, subject, description, requesterEmail, priority },
      { store: locals.ticketStore }
    );
    if (!result.ok || !result.data) {
      return fail(400, { error: "Could not open the ticket." });
    }

    await recordEvent(
      {
        eventName: "support-ticket.created",
        actorId: locals.user.id,
        entityType: "support-ticket",
        entityId: result.data.ticket.id,
        source: "app/support",
        payload: { requesterEmail, priority: result.data.ticket.priority }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, created: true };
  },

  updateStatus: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    // Write gate: changing ticket status requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    const status = String(form.get("status") ?? "").trim();

    if (!id || !status) {
      return fail(400, { error: "Pick a ticket and a status." });
    }

    const existing = await getTicket({ id }, { store: locals.ticketStore });
    if (!existing.ok || !existing.data || existing.data.ticket.tenantId !== activeOrgId) {
      return fail(404, { error: "Ticket not found for this company." });
    }

    const result = await updateTicket({ id, status }, { store: locals.ticketStore });
    if (!result.ok || !result.data) {
      return fail(400, { error: "Could not update the ticket." });
    }

    await recordEvent(
      {
        eventName: "support-ticket.status_changed",
        actorId: locals.user.id,
        entityType: "support-ticket",
        entityId: result.data.ticket.id,
        source: "app/support",
        payload: { status: result.data.ticket.status }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, updated: true };
  }
};
