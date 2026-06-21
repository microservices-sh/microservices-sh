import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Don't watch the local D1 state: each request mutates the SQLite WAL under
  // .wrangler, which would otherwise trigger an endless dev reload loop.
  server: { watch: { ignored: ["**/.wrangler/**"] } },
  // These workspace packages ship .svelte (the module's shared Preview + the DS
  // it imports), so SvelteKit must bundle+compile them, not externalize them.
  ssr: { noExternal: ["@microservices-sh/ui"] }
});
