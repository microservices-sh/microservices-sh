import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const workerPath = join(here, "../.svelte-kit/cloudflare/_worker.js");
const hooksPath = join(here, "../.svelte-kit/output/server/entries/hooks.server.js");
const hooksImport = 'import { scheduled as __microservices_scheduled } from "./../output/server/entries/hooks.server.js";';

if (!existsSync(workerPath)) {
  console.log("[inject-scheduled] Worker output not found; skipping.");
  process.exit(0);
}

let workerCode = readFileSync(workerPath, "utf8");

if (workerCode.includes("__microservices_scheduled") || workerCode.includes("export async function scheduled") || /export\s*\{[^}]*scheduled[^}]*\}/.test(workerCode)) {
  console.log("[inject-scheduled] Scheduled handler already exported.");
  process.exit(0);
}

if (!existsSync(hooksPath) || !readFileSync(hooksPath, "utf8").includes("scheduled")) {
  console.log("[inject-scheduled] No compiled scheduled export found.");
  process.exit(0);
}

const exportDefaultRegex = /export\s*\{([^}]*\b(\w+)\s+as\s+default[^}]*)\}/;
const match = workerCode.match(exportDefaultRegex);

if (!match) {
  console.warn("[inject-scheduled] Could not find default export pattern.");
  process.exit(0);
}

const defaultVarName = match[2];
const otherExports = match[1]
  .split(",")
  .map((s) => s.trim())
  .filter((s) => !s.includes("as default"))
  .filter(Boolean);

const combinedVar = `var __combined_worker = { ...${defaultVarName}, scheduled: __microservices_scheduled };`;
const newExports = [...otherExports, "__combined_worker as default"].join(", ");
workerCode = `${hooksImport}\n${workerCode.replace(exportDefaultRegex, `${combinedVar}\nexport { ${newExports} }`)}`;
writeFileSync(workerPath, workerCode);
console.log("[inject-scheduled] Added scheduled to default Worker export.");
