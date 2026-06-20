import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      // Some @microservices-sh/ui components (NavProgress) import SvelteKit's
      // $app/stores. This harness has no Kit — stub it so the DS barrel resolves.
      "$app/stores": fileURLToPath(new URL("./src/app-stores-stub.js", import.meta.url))
    }
  },
  server: {
    // allow importing module .svelte previews from elsewhere in the monorepo
    fs: { allow: [".."] }
  }
});
