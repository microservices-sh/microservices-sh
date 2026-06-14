import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals }) => {
  return { user: locals.user };
};

export const actions: Actions = {
  // Local demo sign-in: choose the principal whose session is established. The
  // real flow is passwordless email-code via @microservices-sh/auth; wire its
  // verifyToken/session here before beta. We only set the demo session cookie.
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const role = form.get("role") === "staff" ? "staff" : "customer";
    cookies.set("portal_role", role, { path: "/", httpOnly: true, sameSite: "lax" });
    throw redirect(303, role === "staff" ? "/admin" : "/portal");
  }
};
