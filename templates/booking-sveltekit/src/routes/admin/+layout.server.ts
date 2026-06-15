import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

// Authorization gate for the entire /admin/* tree. The admin pages render
// customer PII (names, emails, phones), so this fails closed: any request
// without an admin session is rejected before a page load runs.
//
// `locals.user` is set in src/hooks.server.ts — a real gateway.admin-scoped
// session in production, or a local-dev admin (dev only). No admin session
// (e.g. production before a login flow is wired) => 401, never a PII leak.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user?.isAdmin) {
    throw error(401, "Admin authentication required.");
  }
  return {
    user: { id: locals.user.id, email: locals.user.email, isAdmin: true }
  };
};
