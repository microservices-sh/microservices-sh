import type { LayoutServerLoad } from "./$types";
import { buildSettingsNav } from "$lib/server/settings-nav";

// The Settings hub sub-nav, gated by the enabled module set. Child settings
// pages render inside the layout's content column.
export const load: LayoutServerLoad = async ({ platform }) => {
  return { settingsNav: buildSettingsNav(platform) };
};
