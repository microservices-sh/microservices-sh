// @ts-check
import { defineConfig } from "astro/config";

// Pure static company landing page — no SSR adapter. Builds to ./dist and
// uploads to any static host (Cloudflare Pages/Workers static assets, etc.).
// Set `site` to your production origin so canonical URLs and OG tags resolve.
export default defineConfig({
  output: "static",
  site: "https://example.com",
});
