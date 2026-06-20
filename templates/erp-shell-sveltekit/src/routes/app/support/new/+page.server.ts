import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createTicket } from "@microservices-sh/support-ticket";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("support-ticket", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  // Opening tickets requires member.manage; gate the page itself.
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
  return {};
};

export const actions: Actions = {
  // Open the ticket and land on its detail page.
  default: async ({ request, locals, cookies }) => {
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
        source: "app/support/new",
        payload: { requesterEmail, priority: result.data.ticket.priority }
      },
      { auditStore: locals.auditStore }
    );

    throw redirect(303, `/app/support/${result.data.ticket.id}`);
  }
};
