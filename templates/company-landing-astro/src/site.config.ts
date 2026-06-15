/* ─────────────────────────────────────────────────────────────────────────
   Site content is data, not code. Edit src/content.json to make this your
   company's site — see content.schema.json for the contract (fields, limits,
   hints) and CLAUDE.md for the agent customization playbook.

   The SiteContent type is GENERATED from content.schema.json (src/content.types.ts)
   so the type can never drift from the contract. You should not need to touch
   this file.
   ───────────────────────────────────────────────────────────────────────── */

import content from "./content.json";
import type { SiteContent } from "./content.types";

export type { SiteContent, Link, TitleBody } from "./content.types";
export type Site = SiteContent;

// Runtime shape is enforced by `npm run validate` (schema → content.json),
// which also gates `npm run build`, so this boundary assertion is sound.
export const site = content as SiteContent;
export const theme = site.theme ?? {};
