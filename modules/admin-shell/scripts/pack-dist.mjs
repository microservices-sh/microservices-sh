// Produce a self-contained, installable tarball of admin-shell for consumers
// OUTSIDE this pnpm workspace (the separate api/ Worker repo).
//
// Why a staging dir instead of `pnpm pack` directly: the source package.json
// declares `@microservices-sh/connection-contract` (workspace:*) and `zod` as
// runtime deps. Those are BUNDLED into dist/ by build-dist.mjs, so the consumer
// must not try to resolve them from a registry. publishConfig can override
// exports/main but NOT `dependencies`, so we stage a trimmed package.json with
// an empty dependency set and pack from there.
//
// Usage:
//   node scripts/build-dist.mjs                       # build dist/
//   node scripts/pack-dist.mjs [--out <dir>]          # stage + npm pack
//
// Default --out is ./ (cwd of the script invocation's package dir).

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Parse --out
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? resolve(process.cwd(), args[outIdx + 1]) : root;

// 1) (Re)build dist (JS bundle + self-contained .d.ts) to guarantee freshness.
execFileSync(process.execPath, [resolve(here, "build-dist.mjs")], {
  stdio: "inherit"
});

// 2) Stage a clean package: dist/ + a trimmed package.json (no deps — bundled).
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const staged = {
  name: pkg.name,
  version: pkg.version,
  type: "module",
  description: pkg.description,
  // Deps are bundled into dist/, so the consumer needs nothing installed.
  main: "./dist/index.js",
  // Top-level + per-subpath `types` so out-of-workspace consumers (api/) resolve
  // the self-contained declarations. The .d.ts inline connection-contract + zod
  // types (see build-dts.mjs), mirroring how the JS bundle inlines the runtime.
  types: "./dist/index.d.ts",
  exports: {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./types": { types: "./dist/types.d.ts", import: "./dist/types.js" },
    "./schemas": { types: "./dist/schemas.d.ts", import: "./dist/schemas.js" },
    "./hooks": { types: "./dist/hooks.d.ts", import: "./dist/hooks.js" },
    "./registry": { types: "./dist/registry.d.ts", import: "./dist/registry.js" },
    "./authz": { types: "./dist/authz.d.ts", import: "./dist/authz.js" },
    "./adapters/d1": { types: "./dist/adapters/d1.d.ts", import: "./dist/adapters/d1.js" },
    "./adapters/memory": {
      types: "./dist/adapters/memory.d.ts",
      import: "./dist/adapters/memory.js"
    }
  },
  files: ["dist"],
  license: pkg.license ?? "MIT"
};

const stage = mkdtempSync(join(tmpdir(), "admin-shell-pack-"));
try {
  cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
  writeFileSync(join(stage, "package.json"), JSON.stringify(staged, null, 2) + "\n");
  // npm pack from the staging dir → tarball in outDir.
  const out = execFileSync("npm", ["pack", "--pack-destination", outDir], {
    cwd: stage,
    encoding: "utf8"
  });
  const tarball = out.trim().split("\n").pop();
  console.log(`packed: ${join(outDir, tarball)}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
