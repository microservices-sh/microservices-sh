import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

// Single-company ERP shell has no marketing funnel: the root always routes into
// the app (when signed in) or to login. The /app layer handles the one-time
// company setup for a signed-in user with no org yet.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(307, "/app");
  throw redirect(307, "/login");
};
