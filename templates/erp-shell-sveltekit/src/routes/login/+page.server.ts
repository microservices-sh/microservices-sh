import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { loadCompanyContext } from "$lib/server/org-context";

// Real passwordless login: the page posts to /api/login (request → verify).
// Already signed in with company access? Skip straight to the app. A signed-in
// non-member stays here with a clear access message instead of entering the
// /app → /signup → /login redirect loop.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const canSetUpCompany = !(await locals.rbacStore.anyOrganizationExists());
  if (locals.user) {
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (org) throw redirect(303, "/app");
    return {
      canSetUpCompany,
      noCompanyAccess: true,
      signedInEmail: locals.user.email
    };
  }

  return {
    canSetUpCompany,
    noCompanyAccess: false,
    signedInEmail: null
  };
};
