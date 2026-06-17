import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import emdash from "emdash/astro";
import { d1, r2 } from "@emdash-cms/cloudflare";

export default defineConfig({
  site: process.env.SITE_URL || process.env.EMDASH_SITE_URL || "http://localhost:4321",
  output: "server",
  adapter: cloudflare(),
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB" }),
      storage: r2({ binding: "MEDIA" }),
      siteUrl: process.env.EMDASH_SITE_URL || process.env.SITE_URL,
    }),
  ],
});
