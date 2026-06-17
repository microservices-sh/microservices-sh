import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { resolvePermissions } from "@microservices-sh/org-team-rbac";
import { loadCompanyContext } from "$lib/server/org-context";
import { buildNav } from "$lib/server/erp-nav";

// Membership gate for the whole /app/* tree. A signed-in user with no company org
// is sent to one-time setup; otherwise we resolve the company org and the user's
// effective permissions once, for child routes and the sidebar to reuse. The
// sidebar entries are derived from the installed module set (erp-nav).
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) throw redirect(303, "/login");

  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  const nav = buildNav();

  if (!org) {
    return { activeOrgId: null, activeOrg: null, permissions: [] as string[], nav };
  }

  const permissions = await resolvePermissions(org.id, locals.user.id, { store: locals.rbacStore });

  return {
    activeOrgId: org.id,
    activeOrg: { id: org.id, name: org.name, slug: org.slug },
    permissions,
    nav
  };
};
