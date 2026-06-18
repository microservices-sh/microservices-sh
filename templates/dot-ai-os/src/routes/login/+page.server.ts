import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

// Real passwordless login: the page posts to /api/login (request → verify).
// Already signed in? Skip straight to the app.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, "/app");
  return {};
};
