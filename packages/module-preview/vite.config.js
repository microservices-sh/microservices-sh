import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

// Dev-only API: POST /api/research runs the real module + /last30days engine in
// Node (via ssrLoadModule). Only attached in `vite dev`; the static build has no
// backend, so the harness falls back to demo data there.
function liveResearchApi() {
  return {
    name: "live-research-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/research") return next();
        let body = "";
        for await (const c of req) body += c;
        try {
          const mod = await server.ssrLoadModule("/src/server/research-handler.ts");
          const { topic, channels } = JSON.parse(body || "{}");
          const out = await mod.research(String(topic ?? ""), Array.isArray(channels) ? channels : []);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(out));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String((e && e.message) || e) }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [svelte(), liveResearchApi()],
  resolve: {
    alias: {
      // Some @microservices-sh/ui components (NavProgress) import SvelteKit's
      // $app/stores. This harness has no Kit — stub it so the DS barrel resolves.
      "$app/stores": fileURLToPath(new URL("./src/app-stores-stub.js", import.meta.url))
    }
  },
  server: {
    fs: { allow: [".."] }
  }
});
