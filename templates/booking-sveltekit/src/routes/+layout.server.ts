import type { LayoutServerLoad } from "./$types";
import { getCompanySettings } from "$lib/server/settings";

// Loads company settings (via Drizzle) for every page — brand name, timezone,
// currency. Falls back to defaults when D1 isn't bound (local dev).
export const load: LayoutServerLoad = async ({ platform }) => {
  const settings = await getCompanySettings(platform?.env?.DB);
  return {
    settings: {
      name: settings.name,
      timezone: settings.timezone,
      currency: settings.currency,
    },
  };
};
