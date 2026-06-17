import type { LayoutServerLoad } from "./$types";

// Root context: just the signed-in user. The single-company app shell (org,
// permissions, lock-driven sidebar) is resolved in /app/+layout.server.ts.
export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: locals.user };
};
