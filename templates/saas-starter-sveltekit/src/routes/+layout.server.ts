import type { LayoutServerLoad } from "./$types";
import { loadOrgMemberships } from "$lib/server/org-context";

// App-shell context: the signed-in user plus the orgs they belong to and the
// active org, so the layout can render the org switcher. Membership is always
// re-validated against the RBAC store, never trusted from the cookie alone.
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) {
    return { user: null, orgs: [], activeOrgId: null };
  }

  const { orgs, activeOrgId } = await loadOrgMemberships(cookies, locals.user.id, locals.rbacStore);

  return {
    user: locals.user,
    orgs: orgs.map((org) => ({ id: org.id, name: org.name, slug: org.slug })),
    activeOrgId
  };
};
