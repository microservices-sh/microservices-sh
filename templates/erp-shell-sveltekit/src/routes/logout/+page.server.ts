import type { Actions, PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { clearSession } from "$lib/server/session";

export const load: PageServerLoad = async () => {
  throw redirect(303, "/");
};

export const actions: Actions = {
  default: async ({ cookies }) => {
    clearSession(cookies);
    throw redirect(303, "/login");
  }
};
