#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   Content validator for the template content contract.
   Canonical source: create-microservices-app/assets/validate-content.mjs.
   Each template carries a synced copy at scripts/validate-content.mjs — edit the
   canonical source and run `pnpm --filter create-microservices-app
   gen:template-types`; do not hand-edit the copies.

   Validates src/content.json against content.schema.json. Zero dependencies —
   implements the JSON Schema keyword subset the content contracts use (type,
   required, additionalProperties, properties, enum, pattern, min/maxLength,
   min/maxItems, items, $ref → $defs, format: uri). Runs automatically before
   `npm run build` (prebuild) and via `npm run validate`.
   ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson(rel) {
  try {
    return JSON.parse(readFileSync(resolve(root, rel), "utf8"));
  } catch (e) {
    console.error(`✗ ${rel} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

const schema = loadJson("content.schema.json");
const data = loadJson("src/content.json");
const defs = schema.$defs ?? {};
const errors = [];
const err = (path, msg) => errors.push(`${path || "(root)"}: ${msg}`);

// Guard: this validator implements a fixed JSON Schema subset. If a schema grows
// to use keywords we don't handle (oneOf, allOf, if/then, etc.) we must fail loud
// rather than silently pass invalid content. Walk schema positions and flag any
// keyword outside the supported set.
const SUPPORTED = new Set([
  "$schema", "$id", "$ref", "$defs", "title", "description",
  "type", "required", "properties", "additionalProperties", "items",
  "enum", "pattern", "minLength", "maxLength", "minItems", "maxItems",
  "format", "default", "examples",
]);
function checkKeywords(node, path = "(root)") {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  for (const key of Object.keys(node)) {
    if (key.startsWith("x-") || SUPPORTED.has(key)) continue;
    err(`(schema) ${path}`, `uses unsupported JSON Schema keyword "${key}" — extend scripts/validate-content.mjs (canonical in create-microservices-app/assets) to handle it`);
  }
  if (node.properties) for (const [k, v] of Object.entries(node.properties)) checkKeywords(v, `${path}.${k}`);
  if (node.$defs) for (const [k, v] of Object.entries(node.$defs)) checkKeywords(v, `$defs.${k}`);
  if (node.items) checkKeywords(node.items, `${path}[]`);
  if (node.additionalProperties && typeof node.additionalProperties === "object") checkKeywords(node.additionalProperties, `${path}.*`);
}
checkKeywords(schema);
if (errors.length) {
  console.error(`✗ content.schema.json uses keywords this validator does not support:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

function deref(node) {
  if (node && node.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(node.$ref);
    if (m && defs[m[1]]) return defs[m[1]];
    err("(schema)", `unresolved $ref ${node.$ref}`);
    return {};
  }
  return node;
}

const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

// Lightweight URI check: must have a scheme (https:, mailto:) or be an in-page anchor.
const looksLikeUri = (s) => /^[a-z][a-z0-9+.-]*:/i.test(s);

function validate(rawNode, value, path) {
  const node = deref(rawNode);

  if (node.type && typeOf(value) !== node.type) {
    err(path, `expected ${node.type}, got ${typeOf(value)}`);
    return; // type mismatch — deeper checks would be noise
  }
  if (node.enum && !node.enum.includes(value)) {
    err(path, `must be one of ${node.enum.map((v) => JSON.stringify(v)).join(", ")}`);
  }

  if (node.type === "string" && typeof value === "string") {
    if (node.minLength != null && value.length < node.minLength) err(path, `is too short (min ${node.minLength})`);
    if (node.maxLength != null && value.length > node.maxLength) err(path, `exceeds maxLength ${node.maxLength} (is ${value.length})`);
    if (node.pattern && !new RegExp(node.pattern).test(value)) err(path, `does not match ${node.pattern}`);
    if (node.format === "uri" && !looksLikeUri(value)) err(path, `is not a valid URI (needs a scheme like https:)`);
  }

  if (node.type === "array" && Array.isArray(value)) {
    if (node.minItems != null && value.length < node.minItems) err(path, `has ${value.length} items, needs at least ${node.minItems}`);
    if (node.maxItems != null && value.length > node.maxItems) err(path, `has ${value.length} items, allows at most ${node.maxItems}`);
    if (node.items) value.forEach((v, i) => validate(node.items, v, `${path}[${i}]`));
  }

  if (node.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const props = node.properties ?? {};
    for (const req of node.required ?? []) {
      if (!(req in value)) err(path, `missing required property "${req}"`);
    }
    for (const key of Object.keys(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (props[key]) validate(props[key], value[key], childPath);
      else if (node.additionalProperties === false) err(childPath, `unexpected property (not in schema)`);
    }
  }
}

validate(schema, data, "");

if (errors.length) {
  console.error(`✗ src/content.json failed validation (${errors.length} error${errors.length > 1 ? "s" : ""}):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error(`\nSee content.schema.json for the contract and CLAUDE.md for the playbook.`);
  process.exit(1);
}

console.log("✓ src/content.json is valid against content.schema.json");
