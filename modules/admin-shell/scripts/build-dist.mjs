// Self-contained dist build for @microservices-sh/admin-shell.
//
// Bundles the public entry points to ESM JS in ./dist, INLINING the workspace
// dependency @microservices-sh/connection-contract (and its transitive `zod`)
// so the output can be consumed from repos OUTSIDE this pnpm workspace (notably
// the separate `api/` Cloudflare Worker repo, which has no `workspace:*`
// resolution). Nothing is externalized — the bundle is intentionally complete.
//
// In-monorepo consumers (templates) keep importing the raw `.ts` source via the
// `exports` map in package.json; this build only produces the `dist/` artifacts
// that the published/packed tarball points at (see "publishConfig" in
// package.json). It does not alter source or the source-facing exports.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Public entry points api/ (and other external consumers) will need. Keys are
// the dist-relative output paths (without extension); values are source files.
const entryPoints = {
  index: resolve(root, "src/index.ts"),
  registry: resolve(root, "src/registry.ts"),
  authz: resolve(root, "src/authz.ts"),
  types: resolve(root, "src/types.ts"),
  schemas: resolve(root, "src/schemas.ts"),
  hooks: resolve(root, "src/hooks.ts"),
  "adapters/d1": resolve(root, "src/adapters/d1-table-gateway.ts"),
  "adapters/memory": resolve(root, "src/adapters/memory-table-gateway.ts")
};

await build({
  entryPoints,
  outdir: resolve(root, "dist"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  // Bundle everything (connection-contract + zod) — no externals. This is what
  // makes the artifact self-contained for out-of-workspace consumers.
  external: [],
  logLevel: "info"
});

console.log("admin-shell dist build complete");

// Emit self-contained .d.ts (one per packed entry), with connection-contract +
// zod types inlined so the declarations resolve in out-of-workspace consumers.
execFileSync(process.execPath, [resolve(here, "build-dts.mjs")], {
  stdio: "inherit"
});
