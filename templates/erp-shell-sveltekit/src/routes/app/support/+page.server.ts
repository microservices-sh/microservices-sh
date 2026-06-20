import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listTicketsScoped, authContext } from "@microservices-sh/support-ticket";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("support-ticket", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: any employee with org.read can view the support queue. The
  // queue is read-only here — opening tickets happens at /app/support/new.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Enforced boundary (plan 33): the tenant is taken from the resolved session
  // scope, not from any request input. listTicketsScoped forces tenantId = orgId.
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
