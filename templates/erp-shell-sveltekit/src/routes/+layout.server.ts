import type { LayoutServerLoad } from "./$types";
import { loadCompanyContext } from "$lib/server/org-context";

// Root context: just the signed-in user. The single-company app shell (org,
// permissions, lock-driven sidebar) is resolved in /app/+layout.server.ts.
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) return { user: null, hasCompanyAccess: false };

  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  return { user: locals.user, hasCompanyAccess: Boolean(org) };
};
