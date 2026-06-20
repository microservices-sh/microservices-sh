import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { REPO_TEMPLATES, REPO_TEMPLATE_MODULES, REPO_TEMPLATE_PACKAGES } from "../src/bundled-deps.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const internalAliases = new Map([
  ["@microservices-sh/sdk-internal", resolve(repoRoot, "packages/sdk-internal/src/index.js")],
  ["@microservices-sh/module-contract", resolve(repoRoot, "packages/module-contract/src/index.js")],
]);
const TEMPLATE_IGNORE = new Set([
  "node_modules",
  ".svelte-kit",
  ".astro",
  ".wrangler",
  ".migration",
  "migration-reports",
  "dist",
  ".DS_Store",
  ".git",
]);

function includeTemplateFile(src) {
  return !src.split(/[\\/]/).some((segment) => TEMPLATE_IGNORE.has(segment));
}

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/index.js"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node20"],
  external: [
    "node:child_process",
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:readline/promises",
    "node:url",
  ],
  plugins: [
    {
      name: "internal-workspace-alias",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@microservices-sh\/(sdk-internal|module-contract)$/ }, (args) => ({
          path: internalAliases.get(args.path),
        }));
      },
    },
  ],
  logLevel: "info",
});

await chmod("dist/index.js", 0o755);

// Bundle repo templates next to dist so the CLI can read them at runtime.
// Module source lives in this repo (modules/<id>) - vendor it into the bundled
// template so generated apps are standalone with no remote fetch.
const templatesOut = resolve(packageRoot, "templates");
await rm(templatesOut, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
for (const id of REPO_TEMPLATES) {
  await cp(resolve(repoRoot, "templates", id), resolve(templatesOut, id), {
    recursive: true,
    filter: includeTemplateFile,
  });
  for (const moduleId of REPO_TEMPLATE_MODULES[id] ?? []) {
    await cp(resolve(repoRoot, "modules", moduleId), resolve(templatesOut, id, "modules", moduleId), {
      recursive: true,
      filter: includeTemplateFile,
    });
    process.stdout.write(`  module ${moduleId} <- modules/${moduleId}\n`);
  }
  for (const packageId of REPO_TEMPLATE_PACKAGES[id] ?? []) {
    await cp(resolve(repoRoot, "packages", packageId), resolve(templatesOut, id, "packages", packageId), {
      recursive: true,
      filter: includeTemplateFile,
    });
    process.stdout.write(`  package ${packageId} <- packages/${packageId}\n`);
  }
  process.stdout.write(`bundled template: ${id}\n`);
}
