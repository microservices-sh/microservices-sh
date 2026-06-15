import type { Actions, PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const load: PageServerLoad = async ({ locals }) => {
  return { user: locals.user };
};

export const actions: Actions = {
  // Local demo sign-in: choose the principal whose session is established. The
  // real flow is passwordless email-code via @microservices-sh/auth; wire its
  // verifyToken/session here before beta. We only set the demo session cookie.
  default: async ({ request, cookies }) => {
    if (!dev) {
      // Demo role-picker sign-in is dev-only — it grants a session with no
      // credential. Production must verify a real principal (passwordless
      // email-code via @microservices-sh/auth) before setting any session.
      throw error(403, "Sign-in is not available until real authentication is configured.");
    }
    const form = await request.formData();
    const role = form.get("role") === "staff" ? "staff" : "customer";
    cookies.set("portal_role", role, { path: "/", httpOnly: true, sameSite: "lax" });
    throw redirect(303, role === "staff" ? "/admin" : "/portal");
  }
};
