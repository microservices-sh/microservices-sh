#!/usr/bin/env node
// Self-contained project shim (node built-ins only, zero install).
// Marketing-site template: `check` validates the static-site files. This is a
// module-less template, so module/deploy commands are intentionally minimal.

import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const json = args.includes("--json");
const resource = args.find((a) => !a.startsWith("--"));

function manifestId() {
  try {
    return JSON.parse(readFileSync("microservices.template.json", "utf8")).id;
  } catch {
    return "company-landing-astro";
  }
}

function checkResponse() {
  const files = [
    { id: "manifest", file: "microservices.template.json" },
    { id: "package", file: "package.json" },
    { id: "astro-config", file: "astro.config.mjs" },
    { id: "entry-page", file: "src/pages/index.astro" },
    { id: "content", file: "src/site.config.ts" },
    { id: "tokens", file: "src/styles/tokens.css" },
  ];
  const checks = files.map((c) => {
    const ok = existsSync(c.file);
    return { id: c.id, status: ok ? "pass" : "fail", message: ok ? `${c.file} present.` : `${c.file} missing.` };
  });
  const status = checks.every((c) => c.status === "pass") ? "pass" : "fail";
  return { ok: status === "pass", data: { template: manifestId(), status, checks } };
}

function emit(obj, human) {
  if (json) process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  else process.stdout.write(human(obj));
}

if (resource === "check") {
  const r = checkResponse();
  emit(
    r,
    (o) => `${o.data.status}\n` + o.data.checks.map((c) => `- ${c.id}: ${c.status} - ${c.message}`).join("\n") + "\n",
  );
  process.exitCode = r.ok ? 0 : 1;
} else if (resource === "modules") {
  const r = {
    ok: true,
    data: {
      modules: [],
      note: "Static marketing template — no backend modules. To compose verified modules (auth, payments, audit…), generate a business template like booking-sveltekit. See https://microservices.sh.",
    },
  };
  emit(r, (o) => o.data.note + "\n");
} else {
  const help =
    "company-landing-astro — project commands\n\n" +
    "  node scripts/microservices.js check [--json]     Validate template files\n" +
    "  node scripts/microservices.js modules [--json]   Module info (static site: none)\n\n" +
    "Edit src/site.config.ts to make it yours, src/styles/tokens.css to re-theme.\n" +
    "Preview: npm run dev   ·   Build: npm run build\n";
  emit({ ok: true, data: { help } }, (o) => o.data.help);
}
