import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

// Dev-only API: POST /api/<module-id>/run loads that module's server handler
// (src/server/<id>.ts) via ssrLoadModule and runs it in Node — real engines, no
// build step. Generic per module: add a module's live backend by dropping in
// src/server/<id>.ts that exports `research(topic, channels, opts)`. Only attached
// in `vite dev`; the static build has no backend (wrappers fall back to demo).
function liveModuleApi() {
  return {
    name: "live-module-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url && req.url.match(/^\/api\/([a-z0-9-]+)\/run$/);
        if (req.method !== "POST" || !m) return next();
        const id = m[1];
        let body = "";
        for await (const c of req) body += c;
        res.setHeader("content-type", "application/json");
        try {
          const handler = await server.ssrLoadModule(`/src/server/${id}.ts`).catch(() => null);
          if (!handler || typeof handler.research !== "function") {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: `No live server handler for "${id}" (add src/server/${id}.ts)` }));
          }
          const { topic, channels, apiKey, model } = JSON.parse(body || "{}");
          const out = await handler.research(String(topic ?? ""), Array.isArray(channels) ? channels : [], { apiKey, model });
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
  plugins: [svelte(), liveModuleApi()],
  resolve: {
    alias: {
      // Some @microservices-sh/ui components (NavProgress) import SvelteKit's
      // $app/stores. This harness has no Kit — stub it so the DS barrel resolves.
      "$app/stores": fileURLToPath(new URL("./src/app-stores-stub.js", import.meta.url))
    }
  },
  server: {
    // reach module .svelte previews + module.json across the monorepo
    fs: { allow: ["../.."] }
  }
});
