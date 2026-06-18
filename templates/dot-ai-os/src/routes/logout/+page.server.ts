import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { endSession } from "$lib/server/session";

export const load: PageServerLoad = async () => {
  throw redirect(303, "/");
};

export const actions: Actions = {
  default: async ({ cookies, locals }) => {
    // Delete the server-side session record, then clear the cookie.
    await endSession(cookies, locals.sessionStore);
    throw redirect(303, "/login");
  }
};
