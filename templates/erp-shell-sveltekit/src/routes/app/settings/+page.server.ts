import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listEvents } from "@microservices-sh/audit-log";

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { activeOrg, activeOrgId, permissions } = await parent();
  if (!activeOrgId || !activeOrg || !locals.user) throw redirect(303, "/app");

  // Recent activity for this org from the audit trail, scoped by entity id.
  const activity = await listEvents({ entityId: activeOrgId, limit: 10 }, { auditStore: locals.auditStore });

  return {
    org: activeOrg,
    user: locals.user,
    permissions,
    activity: activity.ok
      ? activity.data.events.map((event) => ({ eventName: event.eventName, createdAt: event.createdAt, source: event.source }))
      : []
  };
};
