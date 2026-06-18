#!/usr/bin/env node
// Phase B - package a built template into an upload-ready deploy artifact.
//
// Input: a built create-microservices-app template dir (after `npm install` +
// `npm run build`). Output: a content-addressed artifact (manifest.json + a
// tarball) the managed control plane can upload to a user's Cloudflare account
// without the user's machine - built once in CI, reused per deploy.
//
// Mirrors the control plane's upload-readiness gate (api `rawSvelteKitBundleSummary`):
// the artifact MUST contain the SvelteKit Cloudflare Worker entry, the SSR
// server bundle, and the build manifest, or it is rejected here (never shipped).
//
// Usage: node scripts/pack-deploy-artifact.mjs <built-app-dir> [--out <dir>] [--template <id>]

import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const options = new Map();
const positional = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg.startsWith("--")) {
    positional.push(arg);
    continue;
  }

  const value = args[i + 1];
  if (!value || value.startsWith("--")) {
    fail(`missing value for ${arg}`);
  }
  options.set(arg, value);
  i += 1;
}

const appDir = resolve(positional[0] ?? ".");
const outDir = resolve(options.get("--out") ?? join(appDir, ".microservices/artifact"));

if (positional.length > 1) {
  fail(`unexpected positional arguments: ${positional.slice(1).join(", ")}`);
}
function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// The build-output trees + deploy config the control plane consumes.
const INCLUDE_DIRS = [".svelte-kit/cloudflare", ".svelte-kit/output/server", ".svelte-kit/cloudflare-tmp", "migrations"];
const INCLUDE_FILES = ["wrangler.jsonc", "microservices.config.json", "microservices.template.json", "microservices.lock.json", "package.json"];

function walk(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
}

if (!existsSync(appDir)) fail(`app dir not found: ${appDir}`);

// Resolve template id + version from the app manifest.
const tpl = existsSync(join(appDir, "microservices.template.json"))
  ? JSON.parse(readFileSync(join(appDir, "microservices.template.json"), "utf8"))
  : {};
const templateId = options.get("--template") ?? tpl.id ?? "unknown";
const version = tpl.version ?? "0.0.0";

// Collect files.
const files = [];
for (const d of INCLUDE_DIRS) {
  const abs = join(appDir, d);
  if (existsSync(abs)) walk(abs, files);
}
for (const f of INCLUDE_FILES) {
  if (existsSync(join(appDir, f))) files.push(join(appDir, f));
}

const entries = files.map((abs) => {
  const path = relative(appDir, abs).split("\\").join("/");
  const buf = readFileSync(abs);
  const contents = buf.toString("utf8");
  // Control-plane GeneratedFile.contents is string-only - track UTF-8 safety.
  const utf8Safe = Buffer.from(contents, "utf8").equals(buf);
  return { path, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), contents, utf8Safe };
});

// Readiness gate (mirror control-plane rawSvelteKitBundleSummary).
const has = (pred) => entries.some(pred);
const missing = [];
if (!has((e) => e.path === ".svelte-kit/cloudflare/_worker.js")) missing.push(".svelte-kit/cloudflare/_worker.js");
if (!has((e) => e.path.startsWith(".svelte-kit/output/server/") && e.path.endsWith(".js"))) missing.push(".svelte-kit/output/server/*.js");
if (!has((e) => e.path === ".svelte-kit/cloudflare-tmp/manifest.js")) missing.push(".svelte-kit/cloudflare-tmp/manifest.js");
if (!has((e) => e.path.startsWith(".svelte-kit/cloudflare/_app/"))) missing.push(".svelte-kit/cloudflare/_app/* (static assets)");
if (!has((e) => e.path.startsWith("migrations/") && e.path.endsWith(".sql"))) missing.push("migrations/*.sql");
if (missing.length) fail(`readiness gate failed - artifact missing:\n   - ${missing.join("\n   - ")}`);

// The control-plane inline artifact carries string contents only, so every file
// must be UTF-8. Fail loud if a template ships binary assets (needs a base64
// GeneratedFile extension before it can use the inline-artifact path).
const binaryFiles = entries.filter((e) => !e.utf8Safe).map((e) => e.path);
if (binaryFiles.length) {
  fail(`artifact has ${binaryFiles.length} binary file(s) (control-plane contents are string-only):\n   - ${binaryFiles.join("\n   - ")}`);
}
// Control-plane inline-artifact limits (api MAX_UPLOADED_ARTIFACT_*).
const MAX_FILES = 1000;
const MAX_BYTES = 4 * 1024 * 1024;
const artifactBytes = entries.reduce((n, e) => n + e.size, 0);
if (entries.length > MAX_FILES) fail(`too many files: ${entries.length} > ${MAX_FILES}`);
if (artifactBytes > MAX_BYTES) fail(`artifact too large: ${artifactBytes} > ${MAX_BYTES} bytes`);

// Emit manifest + tarball.
mkdirSync(outDir, { recursive: true });
const totalBytes = artifactBytes;
entries.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  template: templateId,
  version,
  builtFrom: relative(process.cwd(), appDir) || ".",
  fileCount: entries.length,
  totalBytes,
  ready: true,
  files: entries.map((e) => ({ path: e.path, size: e.size, sha256: e.sha256 })),
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

// Control-plane-consumable artifact ({composition, files}) - matches the api's
// normalizeUploadedArtifact, so createPreviewDeploymentFromArtifact can deploy
// this prebuilt build with no user upload / no Worker-side vite build.
const lock = existsSync(join(appDir, "microservices.lock.json"))
  ? JSON.parse(readFileSync(join(appDir, "microservices.lock.json"), "utf8"))
  : {};
const cfg = existsSync(join(appDir, "microservices.config.json"))
  ? JSON.parse(readFileSync(join(appDir, "microservices.config.json"), "utf8"))
  : {};
const moduleIds = (lock.modules ?? tpl.modules?.required ?? [])
  .map((m) => (typeof m === "string" ? m : m?.id))
  .filter(Boolean);
const payload = {
  source: "ci-prebuilt",
  composition: {
    template: { id: templateId, name: tpl.displayName ?? tpl.name ?? templateId },
    modules: moduleIds.map((id) => ({ id })),
    config: cfg,
  },
  metadata: { template: templateId, version, fileCount: entries.length, totalBytes },
  files: entries.map((e) => ({ path: e.path, contents: e.contents })),
};
writeFileSync(join(outDir, "payload.json"), JSON.stringify(payload));

const tarName = `${templateId}@${version}.tar.gz`;
const tarPath = join(outDir, tarName);
execFileSync("tar", ["-czf", tarPath, "-C", appDir, ...INCLUDE_DIRS.filter((d) => existsSync(join(appDir, d))), ...INCLUDE_FILES.filter((f) => existsSync(join(appDir, f)))]);
const tarSize = statSync(tarPath).size;

console.log(`OK: artifact ready: ${templateId}@${version}`);
console.log(`  files: ${entries.length} | uncompressed: ${(totalBytes / 1024).toFixed(0)} KiB | tar.gz: ${(tarSize / 1024).toFixed(0)} KiB`);
console.log(`  manifest: ${relative(process.cwd(), join(outDir, "manifest.json"))}`);
console.log(`  payload:  ${relative(process.cwd(), join(outDir, "payload.json"))} (control-plane upload shape)`);
console.log(`  tarball:  ${relative(process.cwd(), tarPath)}`);
