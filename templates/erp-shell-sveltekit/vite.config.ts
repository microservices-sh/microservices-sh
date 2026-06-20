import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const devAllowedHosts = (process.env.MICROSERVICES_DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: devAllowedHosts.length ? { allowedHosts: devAllowedHosts } : undefined
});
