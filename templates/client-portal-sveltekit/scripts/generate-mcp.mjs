#!/usr/bin/env node
// Generate the app's MCP artifacts from its installed module set (the lock):
//   generated/tool-manifest.ts  — one governed tool per module rpc method
//   generated/mcp-server.mjs    — the stdio MCP server bootstrap
//
// Run before `tsx generated/mcp-server.mjs` (the `mcp` npm script chains them).
// The handler/dep binding + actor context are NOT generated — they live in the
// hand-authored seam src/lib/server/mcp-wiring.ts, which the entry imports.
//
// Monorepo-resident: reaches the codegen via ../../packages, exactly like the
// check:spec script reaches workspace-tools. An ejected app uses the vendored shim.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateToolManifest, generateToolManifestFile } from "../../../packages/sdk-internal/src/tool-codegen.js";
import { generateMcpServerEntry } from "../../../packages/sdk-internal/src/mcp-tool-server.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Each module's own module.json carries the authoritative rpc contract
// (connections.rpc.exposes). Prefer the installed package's copy, fall back to
// the monorepo source, then to the lock's snapshot (which can lag the contract).
function loadConnections(id) {
  const candidates = [
    join(root, "node_modules", "@microservices-sh", id, "module.json"),
    join(root, "modules", id, "module.json"),
    join(root, "..", "..", "modules", id, "module.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")).connections;
  }
  return undefined;
}

const lock = JSON.parse(readFileSync(join(root, "microservices.lock.json"), "utf8"));
const templateId = typeof lock.template === "object" && lock.template ? lock.template.id : lock.template;
const modules = lock.modules.map((m) => ({
  id: m.id,
  connections: loadConnections(m.id),
  rpc: (m.contract?.rpc ?? []).map((r) => (typeof r === "string" ? { method: r } : r)),
}));

const outDir = join(root, "generated");
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "tool-manifest.ts"), generateToolManifestFile(modules));
writeFileSync(
  join(outDir, "mcp-server.mjs"),
  generateMcpServerEntry({
    id: templateId ?? "app",
    manifestModule: "./tool-manifest.js",
    wiringModule: "../src/lib/server/mcp-wiring.js",
  }),
);

const toolCount = modules.reduce((n, m) => n + generateToolManifest(m).length, 0);
console.log(`Generated MCP artifacts for ${toolCount} tools → generated/{tool-manifest.ts, mcp-server.mjs}`);
