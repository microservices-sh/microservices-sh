import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // These workspace packages ship .svelte (the module's shared Preview + the DS
  // it imports), so SvelteKit must bundle+compile them, not externalize them.
  ssr: { noExternal: ["@microservices-sh/ui"] }
});
