import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { writeSession, userIdForEmail, isSuperAdminEmail } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, "/app");
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return fail(400, { error: "Enter a valid email address.", values: { email } });
    }

    // Demo sign-in: any known email logs in. A returning user keeps the same id
    // (and any org memberships) via the deterministic id mapping.
    const user = { id: userIdForEmail(email), email, isSuperAdmin: isSuperAdminEmail(email) };
    writeSession(cookies, user);

    // If the user already has a membership in a remembered org, the app shell
    // picks it up; otherwise the dashboard prompts them to create one.
    void locals;
    throw redirect(303, "/app");
  }
};
