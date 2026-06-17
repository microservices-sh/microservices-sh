#!/usr/bin/env node
// msh-ui — shadcn-style copy-in CLI for @microservices-sh/ui.
// Copies canonical components + design tokens into a consuming repo, which then
// OWNS its copy (compiled by its own toolchain — robust to Vite/TS version skew
// across web-portal, admin, and the inner-monorepo templates).
//
//   msh-ui list                       list available components
//   msh-ui init [--dir <path>]        copy tokens.css + write a manifest
//   msh-ui add <Name...> [--dir <p>]  copy components (+ tokens) + barrel
//   msh-ui sync [--dir <path>]        re-copy everything in the manifest (update)
//
// Default target dir is the current working directory. Files land in
// <dir>/src/lib/ui/ and a .msh-ui.json manifest records what was added.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(SRC_ROOT, "registry.json"), "utf8"));
const byName = new Map(registry.components.map((c) => [c.name.toLowerCase(), c]));

function parseArgs(argv) {
  const args = { _: [], dir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") args.dir = resolve(argv[++i]);
    else args._.push(argv[i]);
  }
  return args;
}

function uiDir(dir) {
  return join(dir, "src", "lib", "ui");
}
function manifestPath(dir) {
  return join(uiDir(dir), ".msh-ui.json");
}
function readManifest(dir) {
  const p = manifestPath(dir);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { style: registry.style, components: [] };
}
function writeManifest(dir, manifest) {
  writeFileSync(manifestPath(dir), JSON.stringify(manifest, null, 2) + "\n");
}

function copyTokens(dir) {
  mkdirSync(uiDir(dir), { recursive: true });
  copyFileSync(join(SRC_ROOT, registry.tokens), join(uiDir(dir), "tokens.css"));
}

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />';

// Ensure the IBM Plex webfont is loaded (tokens.css deliberately doesn't @import
// it — see that file's header). Idempotent: skips if already present.
function ensureFontLink(dir) {
  const appHtml = join(dir, "src", "app.html");
  if (!existsSync(appHtml)) return;
  const html = readFileSync(appHtml, "utf8");
  if (html.includes("IBM+Plex")) return;
  if (!html.includes("</head>")) return;
  writeFileSync(appHtml, html.replace("</head>", `\t${FONT_LINK}\n\t</head>`));
  console.log("  + IBM Plex <link> added to src/app.html");
}

// Resolve a component + its declared deps, transitively, deduped in order.
function resolveWithDeps(names) {
  const out = [];
  const seen = new Set();
  function visit(name) {
    const c = byName.get(name.toLowerCase());
    if (!c) throw new Error(`Unknown component: ${name}. Run 'msh-ui list'.`);
    for (const d of c.deps ?? []) visit(d);
    if (!seen.has(c.name)) {
      seen.add(c.name);
      out.push(c);
    }
  }
  for (const n of names) visit(n);
  return out;
}

function copyComponents(dir, comps) {
  mkdirSync(uiDir(dir), { recursive: true });
  for (const c of comps) {
    copyFileSync(join(SRC_ROOT, c.file), join(uiDir(dir), `${c.name}.svelte`));
  }
}

function writeBarrel(dir, names) {
  const lines = names
    .slice()
    .sort()
    .map((n) => `export { default as ${n} } from "./${n}.svelte";`);
  writeFileSync(join(uiDir(dir), "index.ts"), lines.join("\n") + "\n");
}

function cmdList() {
  console.log(`@microservices-sh/ui — style: ${registry.style}\nComponents:`);
  for (const c of registry.components) console.log(`  ${c.name}`);
  console.log(`\nUsage: msh-ui add Button Card --dir <app>`);
}

function cmdInit(dir) {
  copyTokens(dir);
  ensureFontLink(dir);
  const manifest = readManifest(dir);
  writeManifest(dir, manifest);
  console.log(`✓ tokens.css → ${uiDir(dir)}\n  Import it once in your app.css:  @import "$lib/ui/tokens.css";`);
}

function cmdAdd(dir, names) {
  if (names.length === 0) throw new Error("add: name a component, e.g. 'msh-ui add Button'");
  const comps = resolveWithDeps(names);
  copyTokens(dir);
  ensureFontLink(dir);
  copyComponents(dir, comps);
  const manifest = readManifest(dir);
  const set = new Set([...manifest.components, ...comps.map((c) => c.name)]);
  manifest.style = registry.style;
  manifest.components = [...set].sort();
  writeManifest(dir, manifest);
  writeBarrel(dir, manifest.components);
  console.log(`✓ added ${comps.map((c) => c.name).join(", ")} → ${uiDir(dir)}`);
  console.log(`  import { ${comps.map((c) => c.name).join(", ")} } from "$lib/ui";`);
}

function cmdSync(dir) {
  const manifest = readManifest(dir);
  if (manifest.components.length === 0) {
    console.log("Nothing to sync — run 'msh-ui add <Name>' first.");
    return;
  }
  const comps = resolveWithDeps(manifest.components);
  copyTokens(dir);
  ensureFontLink(dir);
  copyComponents(dir, comps);
  manifest.style = registry.style;
  manifest.components = comps.map((c) => c.name).sort();
  writeManifest(dir, manifest);
  writeBarrel(dir, manifest.components);
  console.log(`✓ synced ${comps.length} component(s) + tokens → ${uiDir(dir)}`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case "list": return cmdList();
    case "init": return cmdInit(args.dir);
    case "add": return cmdAdd(args.dir, args._);
    case "sync": return cmdSync(args.dir);
    default:
      console.log("msh-ui <list|init|add|sync> [--dir <path>]");
      process.exit(cmd ? 1 : 0);
  }
}

try {
  main();
} catch (err) {
  console.error(`msh-ui: ${err.message}`);
  process.exit(1);
}
