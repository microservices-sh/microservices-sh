#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   Sync the content-contract tooling into every template that ships a content
   contract (content.schema.json). For each such template this:
     1. generates src/content.types.ts from the schema (single source of truth —
        the type can never drift from the contract), and
     2. syncs the canonical validator into scripts/validate-content.mjs (so every
        template runs identical validation logic).

   Run after editing any template's content.schema.json, or after editing the
   canonical validator (assets/validate-content.mjs):
     pnpm --filter create-microservices-app gen:template-types
   ───────────────────────────────────────────────────────────────────────── */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const templatesDir = resolve(repoRoot, "templates");
const canonicalValidator = await readFile(resolve(packageRoot, "assets", "validate-content.mjs"), "utf8");

const banner =
  "/* AUTO-GENERATED from content.schema.json — do not edit by hand.\n" +
  "   Regenerate: pnpm --filter create-microservices-app gen:template-types */";

function stripArrayBounds(node) {
  if (Array.isArray(node)) {
    node.forEach(stripArrayBounds);
  } else if (node && typeof node === "object") {
    delete node.minItems;
    delete node.maxItems;
    for (const v of Object.values(node)) stripArrayBounds(v);
  }
}

let count = 0;
for (const entry of await readdir(templatesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const schemaPath = resolve(templatesDir, entry.name, "content.schema.json");
  if (!existsSync(schemaPath)) continue;

  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  // Stable, clean root interface name regardless of the schema's prose title.
  schema.title = "SiteContent";
  delete schema.description;
  // minItems+maxItems makes json-schema-to-typescript emit huge tuple unions.
  // Bounds belong to the runtime validator, not the type — drop them so arrays
  // generate as plain T[]. (Keeps the generated file small and readable.)
  stripArrayBounds(schema);

  const ts = await compile(schema, "SiteContent", {
    bannerComment: banner,
    additionalProperties: false,
    style: { singleQuote: false },
  });

  const out = resolve(templatesDir, entry.name, "src", "content.types.ts");
  await writeFile(out, ts);

  // Sync the canonical validator into the template (templates ship standalone,
  // so each carries its own copy — kept identical via this sync).
  const scriptsDir = resolve(templatesDir, entry.name, "scripts");
  await mkdir(scriptsDir, { recursive: true });
  await writeFile(resolve(scriptsDir, "validate-content.mjs"), canonicalValidator);

  process.stdout.write(`synced content tooling: ${entry.name} (types + validator)\n`);
  count += 1;
}

if (count === 0) process.stdout.write("no templates with content.schema.json found\n");
