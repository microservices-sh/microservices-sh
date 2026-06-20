import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listTicketsScoped, createTicketScoped, updateTicketScoped, authContext } from "@microservices-sh/support-ticket";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view the support queue.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Enforced boundary (plan 33): tenant from the resolved session org.
  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const result = await listTicketsScoped(ctx, {}, { store: locals.ticketStore });

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
  create: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    // Write gate: opening tickets requires member.manage in the workspace org.
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });

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

    // Enforced boundary (plan 33): the ticket's tenant is stamped from the session org.
    const result = await createTicketScoped(
      ctx,
      { subject, description, requesterEmail, priority },
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

  updateStatus: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    // Write gate: changing ticket status requires member.manage in the workspace org.
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    const status = String(form.get("status") ?? "").trim();

    if (!id || !status) {
      return fail(400, { error: "Pick a ticket and a status." });
    }

    // Enforced boundary (plan 33): updateTicketScoped checks ownership against the
    // session org before mutating, replacing the hand-rolled tenant re-check. 404
    // covers both "missing" and "belongs to another workspace".
    const result = await updateTicketScoped(ctx, { id, status }, { store: locals.ticketStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: "Ticket not found for this workspace." });
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
