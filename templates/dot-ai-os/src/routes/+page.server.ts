import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

// DOT AI OS has no marketing funnel inside the generated app: the root routes
// into the operator workspace when signed in, or to login. The /app layer handles
// first-run workspace setup for a signed-in user with no org yet.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(307, "/app");
  throw redirect(307, "/login");
};
