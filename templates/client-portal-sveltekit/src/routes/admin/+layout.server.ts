import { error, redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

// Staff-only gate for the entire /admin/* tree, which renders cross-customer PII
// (customer list, every invoice). Fails closed: no session => /login; a non-staff
// (customer) session => 403. `locals.user` is set in src/hooks.server.ts — a real
// session in production, or a dev-only demo principal.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  if (locals.user.role !== "staff") throw error(403, "Staff access required.");
  return {};
};
