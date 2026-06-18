import type { LayoutServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { adminRegistry } from "$lib/server/admin-registry";

// The super-admin area sits OUTSIDE org scoping: it spans every org. Access is the
// platform-level super-admin flag, not an org role. Non-admins get 403.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  if (!locals.user.isSuperAdmin) throw error(403, "Super-admin access required.");

  return {
    resources: adminRegistry.list().map((def) => ({ name: def.name }))
  };
};
