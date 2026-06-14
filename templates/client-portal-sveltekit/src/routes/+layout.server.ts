import type { LayoutServerLoad } from "./$types";

// Expose the resolved session to every page so the nav can adapt to the role.
export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user
  };
};
