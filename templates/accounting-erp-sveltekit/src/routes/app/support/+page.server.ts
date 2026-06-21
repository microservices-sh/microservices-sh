import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listTicketsScoped, authContext } from "@microservices-sh/support-ticket";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("support-ticket", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(
    cookies,
    locals.user.id,
    activeOrgId,
    "org.read",
    locals.rbacStore
  );
  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const result = await listTicketsScoped(ctx, {}, { store: locals.ticketStore });

  return {
    tickets: (result.data?.tickets ?? []).map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail
    }))
  };
};
