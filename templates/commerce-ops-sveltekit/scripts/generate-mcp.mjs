#!/usr/bin/env node
// Generate the app's MCP artifacts from its installed module set (the lock):
//   generated/tool-manifest.ts  — one governed tool per module rpc method
//   generated/mcp-server.mjs    — the stdio MCP server bootstrap
//
// The generated entry imports the hand-authored seam at
// src/lib/server/mcp-wiring.ts, where module deps and handlers are bound.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateToolManifest, generateToolManifestFile } from "../../../packages/sdk-internal/src/tool-codegen.js";
import { generateMcpServerEntry } from "../../../packages/sdk-internal/src/mcp-tool-server.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const lock = JSON.parse(readFileSync(join(root, "microservices.lock.json"), "utf8"));
const templateId = typeof lock.template === "object" && lock.template ? lock.template.id : lock.template;
const modules = lock.modules.map((m) => ({
  id: m.id,
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
