import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

// Authentication gate for the entire /portal/* tree, which renders the signed-in
// customer's own PII (their invoices and files). Fails closed: no session => /login.
// Per-customer scoping (a customer seeing only its own data) is enforced downstream
// via locals.user.customerId.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  return {};
};
