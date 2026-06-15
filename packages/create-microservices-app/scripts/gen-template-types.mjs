#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   Generate src/content.types.ts for every template that ships a content
   contract (content.schema.json). The schema is the single source of truth;
   the TypeScript type is derived from it so the two can never drift.

   Run after editing any template's content.schema.json:
     pnpm --filter create-microservices-app gen:template-types
   ───────────────────────────────────────────────────────────────────────── */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const templatesDir = resolve(repoRoot, "templates");

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
  process.stdout.write(`generated types: ${entry.name}/src/content.types.ts\n`);
  count += 1;
}

if (count === 0) process.stdout.write("no templates with content.schema.json found\n");
