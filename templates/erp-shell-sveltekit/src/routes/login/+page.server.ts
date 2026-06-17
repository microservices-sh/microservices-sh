import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { writeSession, userIdForEmail, getSessionSecret } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, "/app");
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, locals, platform }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return fail(400, { error: "Enter a valid email address.", values: { email } });
    }

    // Demo sign-in: any known email logs in. A returning user keeps the same id
    // (and any org memberships) via the deterministic id mapping. The signed
    // cookie carries only id+email; super-admin is derived from the allowlist.
    await writeSession(cookies, { id: userIdForEmail(email), email }, getSessionSecret(platform));

    // If the user already has a membership in a remembered org, the app shell
    // picks it up; otherwise the dashboard prompts them to create one.
    void locals;
    throw redirect(303, "/app");
  }
};
