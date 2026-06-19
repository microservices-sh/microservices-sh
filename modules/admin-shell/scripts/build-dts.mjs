// Generate self-contained .d.ts declarations for the packed admin-shell tarball.
//
// The JS bundle (build-dist.mjs) inlines the workspace dep
// @microservices-sh/connection-contract (+ zod) so the artifact is consumable
// from OUTSIDE this pnpm workspace. The declarations must mirror that: each
// emitted .d.ts must NOT contain a bare `from "@microservices-sh/connection-contract"`
// (or `from "zod"`) import, because the staged package ships no runtime deps and
// the consumer (api/) has no workspace resolution for connection-contract.
//
// dts-bundle-generator inlines the types of any package listed in
// `libraries.inlinedLibraries` directly into the emitted declaration, which is
// exactly the behaviour we need to keep the .d.ts dependency-free.
//
// Emits one declaration per packed JS entry point, matching the `exports` map
// staged by pack-dist.mjs.

import { generateDtsBundle } from "dts-bundle-generator";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// dist-relative output path (without .d.ts) -> source entry .ts
const entries = {
  index: "src/index.ts",
  types: "src/types.ts",
  schemas: "src/schemas.ts",
  hooks: "src/hooks.ts",
  registry: "src/registry.ts",
  authz: "src/authz.ts",
  "adapters/d1": "src/adapters/d1-table-gateway.ts",
  "adapters/memory": "src/adapters/memory-table-gateway.ts"
};

// Packages whose types must be INLINED (not left as bare imports) so the emitted
// .d.ts is self-contained for out-of-workspace consumers — mirrors the JS bundle.
const inlinedLibraries = ["@microservices-sh/connection-contract", "zod"];

const entryConfigs = Object.values(entries).map((src) => ({
  filePath: resolve(root, src),
  output: { noBanner: true, sortNodes: true },
  libraries: { inlinedLibraries }
}));

const declarations = generateDtsBundle(entryConfigs, {
  preferredConfigPath: resolve(root, "tsconfig.json")
});

const outKeys = Object.keys(entries);
declarations.forEach((dts, i) => {
  const outPath = join(root, "dist", outKeys[i] + ".d.ts");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, dts);
});

console.log(`admin-shell dts build complete (${declarations.length} declarations)`);
