#!/usr/bin/env node
// Self-contained project shim (node built-ins only, zero install).
// Marketing-site template: `setup` fills content, `check` validates files.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const argv = process.argv.slice(2);
const positionals = argv.filter((a) => !a.startsWith("--"));
const json = argv.includes("--json");
const plan = argv.includes("--plan") || argv.includes("--dry-run");
const resource = positionals[0];

function flagValue(...names) {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--")) return argv[index + 1];
  }
  return null;
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code, message, remediation, details = {}) {
  return { ok: false, error: { code, message, remediation, details } };
}

function emit(obj, human) {
  if (json) process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  else if (!obj.ok) {
    process.stderr.write(`Error: ${obj.error.message}\n`);
    process.stderr.write(`Next: ${obj.error.remediation}\n`);
  } else {
    process.stdout.write(human(obj));
  }
  process.exitCode = obj.ok ? 0 : 1;
}

function manifestId() {
  return readJson("microservices.template.json", {})?.id ?? "company-landing-astro";
}

function checkResponse() {
  const files = [
    { id: "manifest", file: "microservices.template.json" },
    { id: "package", file: "package.json" },
    { id: "astro-config", file: "astro.config.mjs" },
    { id: "entry-page", file: "src/pages/index.astro" },
    { id: "content", file: "src/content.json" },
    { id: "tokens", file: "src/styles/tokens.css" }
  ];
  const checks = files.map((c) => {
    const ok = existsSync(c.file);
    return { id: c.id, status: ok ? "pass" : "fail", message: ok ? `${c.file} present.` : `${c.file} missing.` };
  });
  const status = checks.every((c) => c.status === "pass") ? "pass" : "fail";
  return { ok: status === "pass", data: { template: manifestId(), status, checks } };
}

function setupSchemaFields(schema, parentPath = [], parentRequired = true) {
  if (!isRecord(schema?.properties)) return [];

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields = [];
  for (const [name, definition] of Object.entries(schema.properties)) {
    if (!isRecord(definition)) continue;
    const path = [...parentPath, name];
    const type = Array.isArray(definition.type) ? definition.type[0] : definition.type;
    const isRequired = parentRequired && required.has(name);
    if (type === "object" && isRecord(definition.properties)) {
      fields.push(...setupSchemaFields(definition, path, isRequired));
      continue;
    }
    fields.push({
      path,
      id: path.join("."),
      prompt: cleanString(definition["x-prompt"]) ?? `Enter ${cleanString(definition.title) ?? path.join(".")}`,
      title: cleanString(definition.title) ?? path.join("."),
      type: type ?? "string",
      required: isRequired,
      enum: Array.isArray(definition.enum) ? definition.enum : null,
      default: definition.default,
      minItems: Number.isInteger(definition.minItems) ? definition.minItems : null,
      maxItems: Number.isInteger(definition.maxItems) ? definition.maxItems : null,
      itemType: Array.isArray(definition.items?.type) ? definition.items.type[0] : definition.items?.type
    });
  }
  return fields;
}

function setPathValue(target, path, value) {
  let cursor = target;
  for (const [index, part] of path.entries()) {
    if (index === path.length - 1) {
      cursor[part] = value;
      return target;
    }
    if (!isRecord(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  return target;
}

function getPathValue(value, path) {
  let cursor = value;
  for (const part of path) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function present(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function parseAnswer(value, field) {
  const text = String(value ?? "").trim();
  if (!text) return field.default;
  if (field.type === "boolean") return ["1", "true", "yes", "y", "on"].includes(text.toLowerCase());
  if (field.type === "array") {
    if (text.startsWith("[")) return JSON.parse(text);
    const items = text.split(",").map((item) => item.trim()).filter(Boolean);
    if (field.itemType === "object") {
      return items.map((item) => {
        const [name, ...rest] = item.split(":");
        return { name: name.trim(), description: rest.join(":").trim() || name.trim() };
      });
    }
    return items;
  }
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return text;
}

async function promptForInput(schema) {
  const input = {};
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write("company-landing-astro setup\n");
    for (const field of setupSchemaFields(schema)) {
      const choices = field.enum?.length ? ` (${field.enum.join("/")})` : "";
      const defaultText = field.default !== undefined ? ` [${field.default}]` : "";
      const requiredText = field.required && field.default === undefined ? " *" : "";
      const answer = await rl.question(`${field.prompt}${choices}${defaultText}${requiredText}: `);
      const parsed = parseAnswer(answer, field);
      if (parsed !== undefined) setPathValue(input, field.path, parsed);
    }
  } finally {
    rl.close();
  }
  return input;
}

function validateInput(schema, input) {
  const missing = [];
  const invalid = [];
  for (const field of setupSchemaFields(schema)) {
    const value = getPathValue(input, field.path);
    if (field.required && !present(value)) missing.push(field.id);
    if (!present(value)) continue;
    if (field.enum && !field.enum.includes(value)) invalid.push({ path: field.id, expected: field.enum, actual: value });
    if (field.type === "array" && !Array.isArray(value)) invalid.push({ path: field.id, expected: "array", actual: typeof value });
    if (field.type === "array" && Array.isArray(value) && field.minItems !== null && value.length < field.minItems) {
      invalid.push({ path: field.id, expected: `at least ${field.minItems} item(s)`, actual: value.length });
    }
  }
  if (missing.length || invalid.length) {
    return fail("SETUP_INPUT_INVALID", "Setup input does not match intake.schema.json.", "Fill the required fields and retry.", { missing, invalid });
  }
  return { ok: true, data: input };
}

function truncate(value, max) {
  const text = cleanString(value);
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function validHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeOfferings(input, fallback = []) {
  const raw = Array.isArray(input) ? input : [];
  const items = raw
    .map((item) => {
      if (typeof item === "string") {
        const [name, ...rest] = item.split(":");
        return { name: cleanString(name), description: cleanString(rest.join(":")) ?? cleanString(name) };
      }
      if (!isRecord(item)) return null;
      return { name: cleanString(item.name), description: cleanString(item.description) ?? cleanString(item.name) };
    })
    .filter((item) => item?.name && item?.description);

  if (items.length) return items;
  return fallback
    .map((item) => ({ name: cleanString(item.title), description: cleanString(item.body) ?? cleanString(item.title) }))
    .filter((item) => item.name && item.description);
}

function pricingPlansForPreference(pricingPreference, existing, ctaHref) {
  if (pricingPreference !== "contact-only") return existing.pricing?.plans ?? [];

  return [
    { name: "Starter", price: "Let's talk", unit: "", bestFor: "Focused first step", features: ["Clear scope", "Fast turnaround", "Direct contact"], cta: { label: "Get started", href: ctaHref }, featured: false },
    { name: "Partner", price: "Custom", unit: "", bestFor: "Ongoing work", features: ["Roadmap support", "Regular delivery", "Priority help"], cta: { label: "Start a conversation", href: ctaHref }, featured: true },
    { name: "Enterprise", price: "Tailored", unit: "", bestFor: "Larger needs", features: ["Scoped program", "Stakeholder reviews", "Launch support"], cta: { label: "Contact us", href: ctaHref }, featured: false }
  ];
}

function contentFromInput(input, existing = {}) {
  const company = truncate(input.company, 40) ?? existing.company ?? "Company";
  const contact = isRecord(input.contact) ? input.contact : {};
  const brand = isRecord(input.brand) ? input.brand : {};
  const description = truncate(input.description, 200) ?? existing.description ?? `${company} helps customers get important work done.`;
  const targetCustomer = truncate(input.targetCustomer, 80) ?? "teams that need dependable help";
  const offerings = normalizeOfferings(input.offerings, existing.features?.items ?? []).slice(0, 3);
  while (offerings.length < 3) offerings.push({ name: ["Plan", "Build", "Support"][offerings.length], description });

  const proof = Array.isArray(input.proof) ? input.proof.map((item) => truncate(item, 40)).filter(Boolean) : [];
  const logoProof = proof.map((item) => truncate(item, 24)).filter(Boolean);
  const email = cleanString(contact.email);
  const ctaHref = email ? `mailto:${email}` : existing.cta?.primary?.href ?? "#";
  const location = cleanString(contact.location);
  const accent = validHexColor(brand.accent) ? brand.accent : existing.theme?.accent ?? "#c14b27";
  const icons = ["engineering", "design", "performance"];
  const pricingPreference = cleanString(input.pricingPreference) ?? "contact-only";
  const pricingPlans = pricingPlansForPreference(pricingPreference, existing, ctaHref);

  return {
    ...existing,
    company,
    domain: cleanString(input.domain) ?? existing.domain ?? "https://example.com",
    description,
    theme: { ...(existing.theme ?? {}), accent },
    hero: {
      ...(existing.hero ?? {}),
      eyebrow: truncate(location ? `${location} - ${company}` : company, 40) ?? company,
      titleLead: "Built for",
      titleEmphasis: truncate(targetCustomer, 40) ?? "ambitious teams",
      titleTail: "that need clarity.",
      lead: truncate(description, 240) ?? description,
      primary: { label: "Get in touch", href: ctaHref },
      secondary: { label: "See services", href: "#features" },
      note: truncate(proof[0] ? `Trusted signal: ${proof[0]}` : `Practical help from ${company}.`, 80) ?? `Practical help from ${company}.`
    },
    logos: {
      ...(existing.logos ?? {}),
      label: proof.length >= 3 ? "Proof points" : existing.logos?.label ?? "Working with",
      items: logoProof.length >= 3 ? logoProof.slice(0, 6) : existing.logos?.items ?? ["Customers", "Partners", "Teams"]
    },
    features: {
      ...(existing.features ?? {}),
      eyebrow: "What we do",
      title: "Services shaped around your work.",
      items: offerings.map((offering, index) => ({
        title: truncate(offering.name, 40) ?? `Offering ${index + 1}`,
        body: truncate(offering.description, 180) ?? description,
        icon: icons[index] ?? "engineering"
      }))
    },
    process: {
      ...(existing.process ?? {}),
      intro: truncate(`We keep the work clear from first conversation to launch for ${targetCustomer}.`, 200) ?? existing.process?.intro
    },
    pricing: {
      ...(existing.pricing ?? {}),
      title: pricingPreference === "contact-only" ? "Pricing matched to the work." : existing.pricing?.title ?? "Simple, fair pricing.",
      intro: pricingPreference === "contact-only"
        ? "Share what you need and we will recommend the right starting point."
        : existing.pricing?.intro ?? "Pick a shape that fits.",
      plans: pricingPlans.length ? pricingPlans : existing.pricing?.plans
    },
    cta: {
      ...(existing.cta ?? {}),
      title: truncate(`Ready to talk to ${company}?`, 60) ?? "Ready to talk?",
      body: truncate(`Tell us what you are trying to build, improve, or launch. ${company} will respond with a clear next step.`, 180) ?? description,
      primary: { label: "Contact us", href: ctaHref },
      secondary: { label: "Review services", href: "#features" }
    },
    footer: {
      ...(existing.footer ?? {}),
      groups: (existing.footer?.groups ?? []).map((group) => {
        if (group?.title !== "Company" || !Array.isArray(group.links)) return group;
        return { ...group, links: group.links.map((link) => link?.label === "Contact" ? { ...link, href: ctaHref } : link) };
      }),
      copyright: company
    }
  };
}

function canPromptForInput() {
  return process.stdin.isTTY && process.stdout.isTTY && !json;
}

async function readSetupInput(schema) {
  const inputPath = flagValue("--input", "--from");
  if (inputPath) return readJson(inputPath, null);
  if (canPromptForInput()) return promptForInput(schema);
  return null;
}

async function setupResponse() {
  const manifest = readJson("microservices.template.json", {});
  const schemaPath = manifest.interactive?.schema ?? "intake.schema.json";
  const contentPath = manifest.interactive?.stores?.content ?? "src/content.json";
  const schema = readJson(schemaPath, null);
  if (!schema) return fail("SETUP_SCHEMA_NOT_FOUND", `Setup schema not found: ${schemaPath}.`, "Restore intake.schema.json and retry.");

  const fields = setupSchemaFields(schema);
  const data = {
    status: "planned",
    target: { kind: "template", id: manifest.id ?? "company-landing-astro" },
    schema: schemaPath,
    writes: [{ type: "content", path: contentPath }],
    fields: fields.map((field) => ({ path: field.id, title: field.title, required: field.required, type: field.type })),
    skills: manifest.skills ?? [],
    nextSteps: ["Review src/content.json.", "Run npm run validate && npm run build."]
  };
  if (plan) return { ok: true, data };

  const input = await readSetupInput(schema);
  if (!input) return fail("SETUP_INPUT_REQUIRED", "Interactive setup needs input.", "Run in a terminal or pass --input setup.json.");

  const validation = validateInput(schema, input);
  if (!validation.ok) return validation;

  const content = contentFromInput(input, readJson(contentPath, {}));
  writeJsonFile(contentPath, content);
  return { ok: true, data: { ...data, status: "configured", written: [{ type: "content", path: contentPath }] } };
}

function formatSetup(obj) {
  const data = obj.data;
  const lines = [`${data.target.id}: ${data.status}`, `Schema: ${data.schema}`];
  const written = data.written ?? data.writes ?? [];
  if (written.length) {
    lines.push("Writes:");
    for (const item of written) lines.push(`- ${item.type}: ${item.path}`);
  }
  if (data.skills?.length) {
    lines.push("Suggested skills:");
    for (const skill of data.skills) lines.push(`- ${typeof skill === "string" ? skill : skill.id}`);
  }
  lines.push("Next:");
  for (const step of data.nextSteps ?? []) lines.push(`- ${step}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  if (resource === "check") {
    const r = checkResponse();
    emit(
      r,
      (o) => `${o.data.status}\n` + o.data.checks.map((c) => `- ${c.id}: ${c.status} - ${c.message}`).join("\n") + "\n"
    );
  } else if (resource === "setup") {
    emit(await setupResponse(), formatSetup);
  } else if (resource === "modules") {
    const r = {
      ok: true,
      data: {
        modules: [],
        note: "Static marketing template - no backend modules. To compose verified modules (auth, payments, audit...), generate a business template like booking-sveltekit. See https://microservices.sh."
      }
    };
    emit(r, (o) => o.data.note + "\n");
  } else {
    const help =
      "company-landing-astro - project commands\n\n" +
      "  node scripts/microservices.js setup [--input setup.json] [--plan] [--json]  Fill src/content.json\n" +
      "  node scripts/microservices.js check [--json]                              Validate template files\n" +
      "  node scripts/microservices.js modules [--json]                            Module info (static site: none)\n\n" +
      "Edit src/content.json to make it yours, src/styles/tokens.css for deeper theme changes.\n" +
      "Preview: npm run dev   Build: npm run build\n";
    emit({ ok: true, data: { help } }, (o) => o.data.help);
  }
}

main().catch((error) => {
  emit(fail("CLI_FAILED", error.message, "Review the command arguments and retry."), (o) => o.error.message + "\n");
});
