import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { chmod, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";

const run = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const REGISTRY_RAW = "https://raw.githubusercontent.com/microservices-sh/registry/main";
const internalAliases = new Map([
  ["@microservices-sh/sdk-internal", resolve(repoRoot, "packages/sdk-internal/src/index.js")],
  ["@microservices-sh/module-contract", resolve(repoRoot, "packages/module-contract/src/index.js")],
]);

const REPO_TEMPLATES = ["booking-sveltekit"];
const REPO_TEMPLATE_MODULES = {
  "booking-sveltekit": ["customer", "booking"],
};
const TEMPLATE_IGNORE = new Set(["node_modules", ".svelte-kit", ".wrangler", "dist", ".DS_Store", ".git"]);

function includeTemplateFile(src) {
  return !src.split(/[\\/]/).some((segment) => TEMPLATE_IGNORE.has(segment));
}

// Deterministic content hash — must match the registry's fetch-module.mjs scheme.
function integrityOf(root) {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (TEMPLATE_IGNORE.has(name)) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else files.push(abs);
    }
  })(root);
  const manifest = files
    .map((f) => `${relative(root, f)}:${createHash("sha256").update(readFileSync(f)).digest("hex")}`)
    .sort()
    .join("\n");
  return `sha256-${createHash("sha256").update(manifest).digest("hex")}`;
}

// Module source is owned by the canonical modules repo and indexed by the
// registry. Bundle it by fetching from there (verifying integrity) — not from a
// copy in this repo — so module source lives in exactly one place.
const cloneCache = new Map();
async function canonicalModule(moduleId) {
  const res = await fetch(`${REGISTRY_RAW}/modules/${moduleId}.json`);
  if (!res.ok) throw new Error(`registry listing missing for module "${moduleId}"`);
  const { dist } = await res.json();
  if (!dist) throw new Error(`module "${moduleId}" has no dist block in its registry listing`);
  const key = `${dist.repo}@${dist.ref}`;
  if (!cloneCache.has(key)) {
    const tmp = await mkdtemp(join(tmpdir(), "ms-build-"));
    await run("git", ["clone", "-q", "--no-tags", `https://github.com/${dist.repo}.git`, tmp]);
    await run("git", ["-C", tmp, "checkout", "-q", dist.ref]);
    cloneCache.set(key, tmp);
  }
  const src = join(cloneCache.get(key), dist.path);
  const integrity = integrityOf(src);
  if (dist.integrity && dist.integrity !== integrity) {
    throw new Error(`integrity mismatch for "${moduleId}"\n  listed:  ${dist.integrity}\n  fetched: ${integrity}`);
  }
  return { src, integrity };
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
const templatesOut = resolve(packageRoot, "templates");
await rm(templatesOut, { recursive: true, force: true });
try {
  for (const id of REPO_TEMPLATES) {
    await cp(resolve(repoRoot, "templates", id), resolve(templatesOut, id), {
      recursive: true,
      filter: includeTemplateFile,
    });
    for (const moduleId of REPO_TEMPLATE_MODULES[id] ?? []) {
      const { src, integrity } = await canonicalModule(moduleId);
      await cp(src, resolve(templatesOut, id, "modules", moduleId), { recursive: true, filter: includeTemplateFile });
      process.stdout.write(`  module ${moduleId} <- canonical (${integrity})\n`);
    }
    process.stdout.write(`bundled template: ${id}\n`);
  }
} finally {
  for (const dir of cloneCache.values()) await rm(dir, { recursive: true, force: true });
}
