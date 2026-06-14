import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { resolvePermissions } from "@microservices-sh/org-team-rbac";
import { loadOrgMemberships } from "$lib/server/org-context";

// Membership gate for the whole /app/* tree. A signed-in user with no org is sent
// to onboarding; otherwise we resolve the active org and the user's effective
// permissions in that org once, for child routes and the layout to reuse.
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) throw redirect(303, "/login");

  const { orgs, activeOrgId } = await loadOrgMemberships(cookies, locals.user.id, locals.rbacStore);
  if (!activeOrgId) {
    return { activeOrgId: null, activeOrg: null, permissions: [] as string[] };
  }

  const activeOrg = orgs.find((org) => org.id === activeOrgId) ?? null;
  const permissions = await resolvePermissions(activeOrgId, locals.user.id, { store: locals.rbacStore });

  return {
    activeOrgId,
    activeOrg: activeOrg ? { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug } : null,
    permissions
  };
};
