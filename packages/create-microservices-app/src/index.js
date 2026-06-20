#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { generateProject, listModuleDocs, listModules, listTemplates } from "@microservices-sh/sdk-internal";
import { loadFrameworks, resolveFramework, buildC3Command, applyFrameworkHook, frameworkNextSteps } from "./framework-starter.js";
import { track, telemetryNotice } from "./telemetry.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(MODULE_DIR, "..");
const PACKAGE_VERSION = readOwnPackageVersion(PACKAGE_ROOT);
const USER_CWD = process.env.INIT_CWD || process.cwd();

// Repo-style templates bundled into the package (see scripts/build.js). These
// are copied verbatim instead of generated procedurally from module-contract.
const TEMPLATES_DIR = resolve(PACKAGE_ROOT, "templates");
const REPO_TEMPLATES = {
  "booking-sveltekit": {
    id: "booking-sveltekit",
    name: "Booking SvelteKit",
    status: "ready",
    summary: "Full Cloudflare SvelteKit booking app — public booking flow, admin, D1, typed hooks.",
  },
  "company-landing-astro": {
    id: "company-landing-astro",
    name: "Company Landing (Astro)",
    status: "ready",
    summary: "Static editorial company landing page on Astro — refined light design, content-driven, no backend modules.",
  },
  "wordpress-emdash-blog-astro": {
    id: "wordpress-emdash-blog-astro",
    name: "WordPress to EmDash Blog (Astro)",
    status: "experimental",
    summary: "Cloudflare Astro + EmDash template for content-only WordPress blog migrations with D1/R2 and source probing.",
  },
  "saas-starter-sveltekit": {
    id: "saas-starter-sveltekit",
    name: "SaaS Starter SvelteKit",
    status: "ready",
    summary: "Multi-tenant B2B SaaS starter on Cloudflare SvelteKit — org sign-up, team RBAC, subscriptions, admin, audit log.",
  },
  "client-portal-sveltekit": {
    id: "client-portal-sveltekit",
    name: "Client Portal SvelteKit",
    status: "ready",
    summary: "Cloudflare SvelteKit client portal — customers see their own invoices and files, with auth, customer, and audit-log.",
  },
  "dot-ai-os": {
    id: "dot-ai-os",
    name: "Corporate OS (DOT AI OS)",
    status: "draft",
    summary: "Dedicated company OS on Cloudflare SvelteKit - operate, research, and advise from workflows, knowledge, decisions, files, team roles, and module-backed work surfaces.",
  },
  "erp-shell-sveltekit": {
    id: "erp-shell-sveltekit",
    name: "ERP Shell SvelteKit",
    status: "ready",
    summary: "Cloudflare SvelteKit ERP shell - customers, invoices, files, support tickets, teams, admin, and audit log.",
  },
};
const BUNDLED_MODULES = [
  "admin-shell",
  "ads-manager",
  "audit-log",
  "auth",
  "billing-subscriptions",
  "booking",
  "calendar-google",
  "customer",
  "email",
  "file-media",
  "forms-intake",
  "gateway",
  "identity",
  "image-generation",
  "invoice",
  "jobs-workflows",
  "notifications-inapp",
  "operator-work",
  "org-team-rbac",
  "payment",
  "support-ticket",
];

function readOwnPackageVersion(packageRoot) {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    return typeof packageJson.version === "string" && packageJson.version ? packageJson.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
const BUNDLED_PACKAGES = new Map([
  ["@microservices-sh/connection-contract", "connection-contract"],
]);

function modulePackageName(moduleId) {
  return `@microservices-sh/${moduleId}`;
}

function rewriteBundledModuleDeps(dependencies, prefix = "./modules") {
  if (!dependencies || typeof dependencies !== "object") return;

  for (const moduleId of BUNDLED_MODULES) {
    const name = modulePackageName(moduleId);
    if (dependencies[name]) {
      dependencies[name] = `file:${prefix}/${moduleId}`;
    }
  }
}

function rewriteBundledPackageDeps(dependencies, prefix = "./packages") {
  if (!dependencies || typeof dependencies !== "object") return;

  for (const [name, packagePath] of BUNDLED_PACKAGES) {
    if (dependencies[name]) {
      dependencies[name] = `file:${prefix}/${packagePath}`;
    }
  }
}

async function readRepoTemplateFiles(templateId) {
  const base = resolve(TEMPLATES_DIR, templateId);
  if (!existsSync(base)) {
    throw new Error(`Bundled template missing: ${templateId}. Rebuild the create package.`);
  }
  const files = [];
  async function walk(directory, rel) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const abs = resolve(directory, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, relPath);
      } else {
        files.push({ path: relPath, contents: await readFile(abs, "utf8") });
      }
    }
  }
  await walk(base, "");
  return files;
}

// wrangler.jsonc allows // line comments; strip them before JSON.parse. The
// rewrite re-serializes to plain JSON, so comments are not preserved (they are
// template guidance, not config). Only whole-line comments are emitted.
function parseJsonc(text) {
  const stripped = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(stripped);
}

function applyRepoTemplateConfig(files, appName, configOverride) {
  return files.map((file) => {
    if (file.path === "package.json") {
      try {
        const pkg = JSON.parse(file.contents);
        pkg.name = appName;
        rewriteBundledModuleDeps(pkg.dependencies);
        rewriteBundledPackageDeps(pkg.dependencies);
        if (pkg.scripts?.["check:spec"]) {
          pkg.scripts["check:spec"] = "node scripts/microservices.js check --json";
        }
        return { ...file, contents: `${JSON.stringify(pkg, null, 2)}\n` };
      } catch {
        return file;
      }
    }
    if (file.path.startsWith("modules/") && file.path.endsWith("/package.json")) {
      try {
        const pkg = JSON.parse(file.contents);
        rewriteBundledModuleDeps(pkg.dependencies, "..");
        rewriteBundledPackageDeps(pkg.dependencies, "../../packages");
        return { ...file, contents: `${JSON.stringify(pkg, null, 2)}\n` };
      } catch {
        return file;
      }
    }
    if (file.path === "microservices.config.json") {
      try {
        const cfg = JSON.parse(file.contents);
        cfg.appName = appName;
        cfg.appSlug = appName;
        Object.assign(cfg, configOverride || {});
        return { ...file, contents: `${JSON.stringify(cfg, null, 2)}\n` };
      } catch {
        return file;
      }
    }
    if (file.path === "wrangler.jsonc") {
      try {
        const cfg = parseJsonc(file.contents);
        cfg.name = appName;
        cfg.vars = {
          ...(cfg.vars || {}),
          MICROSERVICES_APP_SLUG: appName,
        };
        return { ...file, contents: `${JSON.stringify(cfg, null, 2)}\n` };
      } catch {
        return file;
      }
    }
    return file;
  });
}

function repoTemplateModules(files) {
  const manifest = files.find((file) => file.path === "microservices.template.json");
  if (!manifest) return [];
  try {
    return JSON.parse(manifest.contents).modules?.required ?? [];
  } catch {
    return [];
  }
}

function telemetryProps(flags, extra = {}) {
  return {
    source: "create-cli",
    template: flags.template,
    packageManager: flags.packageManager,
    install: flags.install,
    corporateOs: Boolean(flags.os),
    requestedModuleCount: flags.modules?.length ?? 0,
    version: PACKAGE_VERSION,
    ...extra,
  };
}

function durationMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

function availableTemplateList() {
  const sdk = listTemplates();
  const procedural = sdk.ok ? sdk.data : [];
  const repo = Object.values(REPO_TEMPLATES);
  const seen = new Set(procedural.map((template) => template.id));
  const base = [...procedural, ...repo.filter((template) => !seen.has(template.id))];
  const frameworks = loadFrameworks().map((row) => ({
    id: row.id,
    name: `${row.label} (Cloudflare starter)`,
    status: row.status,
    summary: `${row.label} on Cloudflare Workers — empty starter, add modules via microservices.sh.`,
  }));
  const baseIds = new Set(base.map((t) => t.id));
  return [...base, ...frameworks.filter((f) => !baseIds.has(f.id))];
}

function parseArgs(argv) {
  const args = [];
  const flags = {
    template: "booking-sveltekit",
    packageManager: detectPackageManager(),
    install: process.env.CI !== "true",
    json: false,
    config: null,
    dir: USER_CWD,
    modules: null,
    gitRepo: null,
    git: true,
    interactive: false,
    os: false,
    osIntake: null,
    explicit: {
      template: false,
      packageManager: false,
      modules: false,
      git: false,
    },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    } else if (value === "--os" || value === "--corporate-os") {
      flags.os = true;
      if (!flags.explicit.template) flags.template = "dot-ai-os";
    } else if (value === "--template") {
      flags.template = argv[index + 1] || flags.template;
      flags.explicit.template = true;
      index += 1;
    } else if (value === "--dir") {
      flags.dir = argv[index + 1] ? resolve(USER_CWD, argv[index + 1]) : flags.dir;
      index += 1;
    } else if (value === "--package-manager") {
      flags.packageManager = argv[index + 1] || flags.packageManager;
      flags.explicit.packageManager = true;
      index += 1;
    } else if (value === "--modules") {
      flags.modules = csv(argv[index + 1]);
      flags.explicit.modules = true;
      index += 1;
    } else if (value === "--git-repo") {
      flags.gitRepo = argv[index + 1] || "";
      flags.git = true;
      flags.explicit.git = true;
      index += 1;
    } else if (value === "--no-git") {
      flags.git = false;
      flags.gitRepo = null;
      flags.explicit.git = true;
    } else if (value === "--interactive") {
      flags.interactive = true;
    } else if (value === "--os-intake") {
      flags.os = true;
      if (!flags.explicit.template) flags.template = "dot-ai-os";
      try {
        flags.osIntake = JSON.parse(argv[index + 1] || "{}");
      } catch (error) {
        throw new Error(`Invalid --os-intake JSON: ${error.message}`);
      }
      index += 1;
    } else if (value === "--no-install") {
      flags.install = false;
    } else if (value === "--install") {
      flags.install = true;
    } else if (value === "--json") {
      flags.json = true;
    } else if (value === "--config") {
      try {
        flags.config = JSON.parse(argv[index + 1] || "{}");
      } catch (error) {
        throw new Error(`Invalid --config JSON: ${error.message}`);
      }
      index += 1;
    } else if (value === "--help" || value === "-h") {
      args.push("help");
    } else {
      args.push(value);
    }
  }

  return { targetName: args[0], flags };
}

function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";
  return "npm";
}

function usage() {
  return `create-microservices-app ${PACKAGE_VERSION}

Usage:
  npm create microservices-app@latest <app-name>
  npm create microservices-app@latest <app-name> -- --os
  pnpm create microservices-app <app-name>

Options:
  --template <id>              Template id. Default: booking-sveltekit
                               (booking-sveltekit = full Cloudflare SvelteKit app;
                                dot-ai-os = dedicated Corporate OS workspace;
                                wordpress-emdash-blog-astro = content-only WordPress migration;
                                booking-business = Cloudflare Worker / Hono)
  --os                         Corporate OS onboarding mode. Defaults to dot-ai-os and writes company model docs
  --os-intake '<json>'          Non-interactive Corporate OS intake override
  --modules <ids>              Comma-separated extra module ids or id@version pins to enable
  --config '<json>'            Template config override
  --git-repo <url>             Initialize git and add origin remote
  --no-git                     Skip git setup
  --interactive                Prompt for project setup
  --package-manager <name>     npm, pnpm, yarn, or bun
  --dir <path>                 Parent directory. Default: current directory
  --no-install                 Write files without installing dependencies
  --install                    Install dependencies even in CI
  --json                       Print machine-readable output
`;
}

function slugify(value) {
  return String(value || "microservices-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "microservices-app";
}

function titleizeSlug(value) {
  const text = String(value || "company-os").replace(/[-_]+/g, " ").trim();
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Company OS";
}

function cleanText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function cleanOptionalText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (/^(skip|none|no|null)$/i.test(text)) return null;
  return text || null;
}

function cleanList(value, fallback = []) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n;,]+/)
      : [];
  const items = raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function corporateOsSource(config = {}, explicit = null) {
  const cfg = config && typeof config === "object" ? config : {};
  const os = cfg.corporateOs && typeof cfg.corporateOs === "object"
    ? cfg.corporateOs
    : cfg.os && typeof cfg.os === "object"
      ? cfg.os
      : {};
  return {
    ...(cfg.business && typeof cfg.business === "object" ? { business: cfg.business } : {}),
    ...os,
    ...(explicit && typeof explicit === "object" ? explicit : {}),
  };
}

function normalizeCorporateOsIntake(appName, config = {}, explicit = null) {
  const source = corporateOsSource(config, explicit);
  const business = source.business && typeof source.business === "object" ? source.business : {};
  const companyName = cleanText(source.companyName ?? business.name, titleizeSlug(appName));
  const firstWorkflow = cleanText(
    source.firstWorkflow,
    "Capture one operating workflow from intake to owner, decision, and follow-through."
  );

  return {
    schemaVersion: "2026-06-19",
    mode: "corporate-os",
    company: {
      name: companyName,
      website: cleanOptionalText(source.website ?? business.website ?? source.domain),
      industry: cleanText(source.industry, "operations-heavy company"),
      teamSize: cleanText(source.teamSize, "20-500"),
    },
    owner: {
      name: cleanText(source.ownerName ?? source.owner, "Operating owner"),
      email: cleanOptionalText(source.ownerEmail ?? source.email),
    },
    operatingLoop: cleanText(source.operatingLoop, "client-delivery"),
    firstWorkflow,
    research: {
      sources: cleanList(source.knowledgeSources ?? source.researchSources, [
        "Company documents",
        "Customer records",
        "Market and competitor research",
      ]),
    },
    advisory: {
      recurringDecisions: cleanList(source.recurringDecisions ?? source.decisions, [
        "Weekly operating priorities",
        "Client or customer risk review",
        "Next best action for blocked work",
      ]),
    },
    governance: {
      roles: cleanList(source.roles, ["owner", "admin", "member"]),
      approvalRules: cleanList(source.approvalRules, [
        "Human approval required before customer-facing actions",
        "Decision briefs must include sources and assumptions",
        "Material workflow changes must create an audit event",
      ]),
    },
    pilot: {
      successMetric: cleanText(source.successMetric, "Reduce one repeated workflow cycle time by 30%."),
    },
  };
}

function markdownList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function corporateOsArtifacts(intake) {
  const json = `${JSON.stringify(intake, null, 2)}\n`;
  const company = intake.company;
  const ownerEmail = intake.owner.email ? ` <${intake.owner.email}>` : "";
  return [
    {
      path: "microservices.os.json",
      contents: json,
    },
    {
      path: "docs/company-model.md",
      contents: `# Company Model

Company: ${company.name}
Industry: ${company.industry}
Team size: ${company.teamSize}
Website: ${company.website ?? "Not set"}
Operating owner: ${intake.owner.name}${ownerEmail}

## Position

This Corporate OS is dedicated to ${company.name}. It should encode how the company operates, what it researches, and how advice turns into decisions and follow-through.

## Operating Loop

Primary loop: ${intake.operatingLoop}

First workflow:

${intake.firstWorkflow}
`,
    },
    {
      path: "docs/operating-map.md",
      contents: `# Operating Map

## First Workflow

${intake.firstWorkflow}

## Roles

${markdownList(intake.governance.roles)}

## Approval Rules

${markdownList(intake.governance.approvalRules)}

## Implementation Notes

- Keep routes thin; domain behavior belongs in modules.
- Every advisory recommendation should resolve into an owner, task, approval, workflow, report, or decision log.
- Treat chat as an interface, not the system of record.
`,
    },
    {
      path: "docs/research-sources.md",
      contents: `# Research Sources

Use this file to track the sources the OS may use for research and decision support.

## Starting Sources

${markdownList(intake.research.sources)}

## Source Rules

- Label whether a source is internal, customer-provided, public, or vendor-provided.
- Capture freshness expectations for recurring reports.
- Do not connect sensitive systems until permissions and approval rules are explicit.
`,
    },
    {
      path: "docs/decision-briefs.md",
      contents: `# Decision Briefs

Decision briefs are the advisory layer of the Corporate OS. Each brief should show sources, assumptions, options, risks, recommendation, owner, and next action.

## Recurring Decisions

${markdownList(intake.advisory.recurringDecisions)}

## Brief Template

### Question

What decision needs to be made?

### Context

What company, customer, market, or operational context matters?

### Sources

List source documents, records, links, and timestamps.

### Options

Compare the practical choices.

### Risks

Name operational, customer, financial, compliance, or delivery risks.

### Recommendation

Make one recommendation with assumptions.

### Follow-through

Owner, due date, task/workflow link, and decision log entry.
`,
    },
    {
      path: "docs/pilot-plan.md",
      contents: `# Corporate OS Pilot Plan

## Goal

${intake.pilot.successMetric}

## Scope

- Company model: ${company.name}
- Operating loop: ${intake.operatingLoop}
- First workflow: ${intake.firstWorkflow}
- Research sources: ${intake.research.sources.length}
- Recurring decisions: ${intake.advisory.recurringDecisions.length}

## Pilot Exit Criteria

- One operating workflow is usable by the owner.
- At least one research source set is documented.
- At least one decision brief is produced from company context.
- Advisory output creates an owner, action, approval, or decision log.
- Permissions and audit expectations are reviewed before external/customer-facing use.
`,
    },
  ];
}

function applyCorporateOsProfile(files, intake) {
  const patched = files.map((file) => {
    if (file.path !== "microservices.config.json") return file;
    try {
      const cfg = JSON.parse(file.contents);
      cfg.business = {
        ...(cfg.business || {}),
        name: intake.company.name,
        website: intake.company.website,
        industry: intake.company.industry,
        teamSize: intake.company.teamSize,
      };
      cfg.os = {
        mode: intake.mode,
        operatingLoop: intake.operatingLoop,
        firstWorkflow: intake.firstWorkflow,
        owner: intake.owner,
        researchSources: intake.research.sources,
        recurringDecisions: intake.advisory.recurringDecisions,
        successMetric: intake.pilot.successMetric,
      };
      return { ...file, contents: `${JSON.stringify(cfg, null, 2)}\n` };
    } catch {
      return file;
    }
  });

  const existing = new Set(patched.map((file) => file.path));
  for (const artifact of corporateOsArtifacts(intake)) {
    if (!existing.has(artifact.path)) patched.push(artifact);
  }
  return patched;
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function scriptedAnswers() {
  const raw = process.env.MICROSERVICES_CREATE_PROMPT_ANSWERS;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? ""));
  } catch {
    // Fall back to newline-delimited answers for simple shell usage.
  }

  return raw.split(/\r?\n/);
}

function canPrompt(targetName, flags) {
  return (
    flags.interactive ||
    (flags.os && !flags.json && process.env.CI !== "true" && process.stdin.isTTY && process.stdout.isTTY) ||
    (!targetName && !flags.json && process.env.CI !== "true" && process.stdin.isTTY && process.stdout.isTTY)
  );
}

function csv(value) {
  const text = String(value ?? "").trim();
  if (!text || /^(default|template-defaults|none|no|skip)$/i.test(text)) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseModuleSelector(value) {
  const raw = String(value ?? "").trim();
  const at = raw.lastIndexOf("@");
  return at > 0
    ? { id: raw.slice(0, at), version: raw.slice(at + 1) || null, raw }
    : { id: raw, version: null, raw };
}

function moduleSelectorText(selector) {
  return selector.version ? `${selector.id}@${selector.version}` : selector.id;
}

function choiceText(choice) {
  const status = choice.status && choice.status !== "available" ? ` (${choice.status})` : "";
  const summary = choice.summary ? ` - ${choice.summary}` : "";
  return `${choice.id}${status}${summary}`;
}

function printChoices(title, choices) {
  if (!choices.length) return;
  process.stdout.write(`${title}:\n`);
  choices.forEach((choice, index) => {
    process.stdout.write(`  ${index + 1}. ${choiceText(choice)}\n`);
  });
}

function resolveChoice(answer, choices, fallback, label) {
  const text = String(answer ?? "").trim();
  if (!text) return fallback;

  const numeric = /^\d+$/.test(text) ? Number(text) : null;
  if (numeric !== null && numeric >= 1 && numeric <= choices.length) {
    return choices[numeric - 1].id;
  }

  const normalized = text.toLowerCase();
  const match = choices.find((choice) => choice.id.toLowerCase() === normalized || choice.name?.toLowerCase() === normalized);
  if (match) return match.id;

  throw new Error(`Unknown ${label}: ${text}. Choose one of: ${choices.map((choice) => choice.id).join(", ")}.`);
}

function resolveChoices(answer, choices, label) {
  const text = String(answer ?? "").trim();
  if (!text || /^(default|template-defaults|none|no|skip)$/i.test(text)) return [];

  const selected = [];
  for (const token of text.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean)) {
    const choice = resolveChoice(token, choices, null, label);
    if (choice && !selected.includes(choice)) selected.push(choice);
  }
  return selected;
}

const OPERATING_LOOP_CHOICES = [
  { id: "client-delivery", summary: "Client work, deliverables, approvals, handoffs" },
  { id: "sales-service", summary: "Lead intake, sales follow-up, customer service" },
  { id: "internal-ops", summary: "Back-office operations, tasks, reporting, escalations" },
  { id: "research-advisory", summary: "Research briefs, expert advice, client recommendations" },
  { id: "multi-site-ops", summary: "Multi-location or franchise operating cadence" },
];

async function askCorporateOsIntake(appName, flags, ask) {
  const defaults = normalizeCorporateOsIntake(appName, flags.config, flags.osIntake);

  process.stdout.write("\nCorporate OS intake:\n");
  const companyName = cleanText(await ask(`Company name [${defaults.company.name}]: `), defaults.company.name);
  const website = cleanOptionalText(await ask(`Website [${defaults.company.website ?? "skip"}]: `)) ?? defaults.company.website;
  const industry = cleanText(await ask(`Industry [${defaults.company.industry}]: `), defaults.company.industry);
  const teamSize = cleanText(await ask(`Team size [${defaults.company.teamSize}]: `), defaults.company.teamSize);
  const ownerName = cleanText(await ask(`Operating owner [${defaults.owner.name}]: `), defaults.owner.name);
  const ownerEmail = cleanOptionalText(await ask(`Owner email [${defaults.owner.email ?? "skip"}]: `)) ?? defaults.owner.email;

  printChoices("Operating loops", OPERATING_LOOP_CHOICES);
  const operatingLoopAnswer = await ask(`Operating loop number or id [${defaults.operatingLoop}]: `);
  const operatingLoop = resolveChoice(operatingLoopAnswer, OPERATING_LOOP_CHOICES, defaults.operatingLoop, "operating loop");

  const firstWorkflow = cleanText(
    await ask(`First workflow to encode [${defaults.firstWorkflow}]: `),
    defaults.firstWorkflow
  );
  const knowledgeSources = cleanList(
    await ask(`Knowledge/research sources, comma-separated [${defaults.research.sources.join(", ")}]: `),
    defaults.research.sources
  );
  const recurringDecisions = cleanList(
    await ask(`Recurring decisions, comma-separated [${defaults.advisory.recurringDecisions.join(", ")}]: `),
    defaults.advisory.recurringDecisions
  );
  const successMetric = cleanText(
    await ask(`Pilot success metric [${defaults.pilot.successMetric}]: `),
    defaults.pilot.successMetric
  );

  return normalizeCorporateOsIntake(appName, flags.config, {
    companyName,
    website,
    industry,
    teamSize,
    ownerName,
    ownerEmail,
    operatingLoop,
    firstWorkflow,
    knowledgeSources,
    recurringDecisions,
    successMetric,
  });
}

async function askGuidedSetup(targetName, flags) {
  if (!canPrompt(targetName, flags)) {
    return { targetName, flags };
  }

  const answers = scriptedAnswers();
  const rl = answers ? null : createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (prompt) => {
    if (!answers) return rl.question(prompt);
    const answer = answers.shift() ?? "";
    process.stdout.write(`${prompt}${answer}\n`);
    return answer;
  };
  const modules = listModules();

  try {
    let nextTargetName = targetName;
    const nextFlags = { ...flags };

    if (!nextTargetName) {
      const answer = await ask(nextFlags.os ? "Corporate OS project name: " : "Project name: ");
      nextTargetName = answer.trim();
    }

    if (!nextTargetName) {
      throw new Error("Project name is required.");
    }

    if (nextFlags.os && !flags.explicit.template) {
      nextFlags.template = "dot-ai-os";
    } else if (!flags.explicit.template) {
      const availableTemplates = availableTemplateList();
      printChoices("Templates", availableTemplates);
      const answer = await ask(`Template number or id [${nextFlags.template}]: `);
      nextFlags.template = resolveChoice(answer, availableTemplates, nextFlags.template, "template");
    }

    if (!nextFlags.os && !flags.explicit.modules) {
      const docs = listModuleDocs();
      const availableModules = docs.ok ? docs.data : modules.ok ? modules.data : [];
      printChoices("Modules", availableModules);
      const answer = await ask(
        "Extra modules to enable or plan, numbers or ids comma-separated [template defaults]: "
      );
      nextFlags.modules = resolveChoices(answer, availableModules, "module");
    }

    if (nextFlags.os) {
      nextFlags.osIntake = await askCorporateOsIntake(nextTargetName, nextFlags, ask);
    }

    if (!flags.explicit.git && nextFlags.git && nextFlags.gitRepo === null) {
      const answer = await ask("Git remote URL (optional): ");
      nextFlags.gitRepo = answer.trim() || null;
      nextFlags.git = Boolean(nextFlags.gitRepo);
    }

    if (!flags.explicit.packageManager) {
      const packageManagers = ["npm", "pnpm", "yarn", "bun"].map((id) => ({ id }));
      printChoices("Package managers", packageManagers);
      const answer = await ask(`Package manager number or id [${nextFlags.packageManager}]: `);
      nextFlags.packageManager = resolveChoice(answer, packageManagers, nextFlags.packageManager, "package manager");
    }

    return { targetName: nextTargetName, flags: nextFlags };
  } finally {
    if (rl) rl.close();
  }
}

function fail(code, message, remediation, details = {}) {
  return {
    ok: false,
    error: { code, message, remediation, details },
  };
}

function moduleSelection(moduleIds) {
  if (!moduleIds?.length) {
    return {
      ok: true,
      generationModules: [],
      planOnlyModules: [],
      warnings: [],
    };
  }

  const modules = listModules();
  const docs = listModuleDocs();
  const availableModules = modules.ok ? modules.data : [];
  const knownModules = docs.ok ? docs.data : availableModules;
  const availableById = new Map(availableModules.map((module) => [module.id, module]));
  const knownById = new Map(knownModules.map((module) => [module.id, module]));
  const available = availableModules.map((module) => module.id);
  const known = knownModules.map((module) => module.id);
  const generationModules = [];
  const planOnlyModules = [];
  const unknown = [];
  const unavailableVersions = [];

  for (const selector of moduleIds.map(parseModuleSelector)) {
    const availableModule = availableById.get(selector.id);
    const knownModule = knownById.get(selector.id);
    if (!knownModule) {
      unknown.push(selector.raw);
      continue;
    }

    const availableVersions =
      availableModule?.availableVersions ??
      (availableModule?.version ? [availableModule.version] : knownModule.version ? [knownModule.version] : []);
    if (selector.version && availableVersions.length && !availableVersions.includes(selector.version)) {
      unavailableVersions.push({
        moduleId: selector.id,
        requestedVersion: selector.version,
        availableVersions,
      });
      continue;
    }

    if (availableModule) {
      generationModules.push(moduleSelectorText(selector));
    } else {
      planOnlyModules.push(moduleSelectorText(selector));
    }
  }

  if (unavailableVersions.length) {
    return {
      ok: false,
      response: fail(
        "MODULE_VERSION_NOT_FOUND",
        `Requested module version is not available: ${unavailableVersions
          .map((item) => `${item.moduleId}@${item.requestedVersion}`)
          .join(", ")}`,
        "Use an available version from modules list, or omit the version to use the current registry version.",
        { requested: moduleIds, unavailableVersions }
      ),
    };
  }

  if (!unknown.length) {
    return {
      ok: true,
      generationModules,
      planOnlyModules,
      warnings: planOnlyModules.length
        ? [`Plan-only modules were not generated yet: ${planOnlyModules.join(", ")}. Use the generated project CLI add command in plan mode.`]
        : [],
    };
  }

  return {
    ok: false,
    response: fail(
      "MODULE_NOT_FOUND",
      `Unknown module: ${unknown.join(", ")}`,
      "Run with --modules set to known module ids, or omit --modules and use the generated project CLI add command in plan mode.",
      { requested: moduleIds, available, known }
    ),
  };
}

async function assertEmptyOrMissing(targetDirectory) {
  if (!existsSync(targetDirectory)) return;
  const entries = await readdir(targetDirectory);
  const meaningful = entries.filter((entry) => ![".DS_Store"].includes(entry));
  if (meaningful.length > 0) {
    throw new Error(`Target directory is not empty: ${targetDirectory}`);
  }
}

async function writeGeneratedFiles(outputDirectory, files) {
  const root = resolve(outputDirectory);
  await mkdir(root, { recursive: true });
  const written = [];

  for (const file of files) {
    const target = resolve(root, normalize(file.path));
    if (target !== root && !target.startsWith(`${root}/`)) {
      throw new Error(`Refusing to write outside output directory: ${file.path}`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.contents, "utf8");
    written.push(target);
  }

  return { root, written };
}

function installDependencies(root, packageManager) {
  const commands = {
    pnpm: ["pnpm", ["install"]],
    npm: ["npm", ["install"]],
    yarn: ["yarn", ["install"]],
    bun: ["bun", ["install"]],
  };
  const command = commands[packageManager] || commands.npm;
  return spawnSync(command[0], command[1], { cwd: root, stdio: "inherit" });
}

function setupGit(root, gitRepo) {
  if (!gitRepo) {
    return {
      initialized: false,
      remote: null,
    };
  }

  const init = spawnSync("git", ["init"], { cwd: root, stdio: "pipe", encoding: "utf8" });
  if ((init.status ?? 1) !== 0) {
    throw new Error(`Git init failed: ${init.stderr || init.stdout || "unknown error"}`);
  }

  const remote = spawnSync("git", ["remote", "add", "origin", gitRepo], { cwd: root, stdio: "pipe", encoding: "utf8" });
  if ((remote.status ?? 1) !== 0) {
    throw new Error(`Git remote setup failed: ${remote.stderr || remote.stdout || "unknown error"}`);
  }

  return {
    initialized: true,
    remote: gitRepo,
  };
}

function packageScriptCommand(packageManager, script, args = []) {
  if (packageManager === "npm") {
    return ["npm", "run", script, ...(args.length ? ["--", ...args] : [])].join(" ");
  }
  return [packageManager, script, ...args].join(" ");
}

function nextCommands(packageManager, appName, installed, planOnlyModules = [], templateId = "booking-sveltekit") {
  const installLine = installed ? null : `${packageManager} install`;
  const microservices = (args) => packageScriptCommand(packageManager, "microservices", args);
  const devCommand = packageScriptCommand(packageManager, "dev");

  if (templateId === "wordpress-emdash-blog-astro") {
    return [
      `cd ${appName}`,
      installLine,
      microservices(["modules", "--json"]),
      microservices(["wp", "migrate", "--source", "https://example.com", "--theme", "./theme.zip"]),
      packageScriptCommand(packageManager, "wp:probe", ["--source", "https://example.com", "--out", "migration-reports/wp-source-probe.json"]),
      packageScriptCommand(packageManager, "wp:verify", ["--report", "migration-reports/wp-source-probe.json"]),
      microservices(["wp", "plan", "--report", "migration-reports/wp-source-probe.json"]),
      microservices(["check", "--json"]),
      devCommand,
    ].filter(Boolean);
  }

  if (templateId === "dot-ai-os") {
    return [
      `cd ${appName}`,
      installLine,
      microservices(["check", "--json"]),
      devCommand,
    ].filter(Boolean);
  }

  if (templateId !== "booking-sveltekit") {
    return [
      `cd ${appName}`,
      installLine,
      microservices(["modules", "--json"]),
      microservices(["check", "--json"]),
      devCommand,
    ].filter(Boolean);
  }

  const localSetup = [microservices(["local", "setup"])];
  const deployPlan = [microservices(["deploy", "run", "--plan"])];

  return [
    `cd ${appName}`,
    installLine,
    microservices(["modules", "list", "--json"]),
    microservices(["docs", "booking"]),
    ...planOnlyModules.map((moduleId) => microservices(["add", moduleId, "--plan", "--json"])),
    microservices(["upgrade", "booking", "--plan", "--json"]),
    microservices(["check", "--json"]),
    ...localSetup,
    ...deployPlan,
    devCommand,
  ].filter(Boolean);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  if (parsed.targetName === "help") {
    process.stdout.write(usage());
    return;
  }

  const guided = await askGuidedSetup(parsed.targetName, parsed.flags);
  const { targetName, flags } = guided;

  telemetryNotice(flags.json);

  if (!targetName) {
    process.stdout.write(usage());
    return;
  }

  const appName = slugify(targetName);
  const targetDirectory = resolve(flags.dir, appName);
  const corporateOs = flags.os ? normalizeCorporateOsIntake(appName, flags.config, flags.osIntake) : null;
  await track("create_app_started", telemetryProps(flags));
  try {
    await assertEmptyOrMissing(targetDirectory);
  } catch (error) {
    await track("create_app_failed", telemetryProps(flags, { errorCode: "TARGET_NOT_EMPTY", durationMs: durationMs(startedAt) }));
    if (error && typeof error === "object") error.telemetryTracked = true;
    throw error;
  }

  const isRepoTemplate = Boolean(REPO_TEMPLATES[flags.template]);
  const allTemplates = availableTemplateList();
  if (!allTemplates.some((template) => template.id === flags.template)) {
    const response = fail(
      "TEMPLATE_NOT_FOUND",
      `Unknown template: ${flags.template}`,
      "Run with --template set to an available template id.",
      { available: allTemplates.map((template) => template.id) }
    );
    await track("create_app_failed", telemetryProps(flags, { errorCode: "TEMPLATE_NOT_FOUND", durationMs: durationMs(startedAt) }));
    return flags.json ? writeJson(response) : process.stderr.write(`Error: ${response.error.message}\n`);
  }

  if (flags.os && flags.template !== "dot-ai-os") {
    const response = fail(
      "CORPORATE_OS_TEMPLATE_REQUIRED",
      `Corporate OS mode requires the dot-ai-os template. Received: ${flags.template}`,
      "Run with --os and omit --template, or pass --template dot-ai-os.",
      { template: flags.template }
    );
    await track("create_app_failed", telemetryProps(flags, { errorCode: "CORPORATE_OS_TEMPLATE_REQUIRED", durationMs: durationMs(startedAt) }));
    return flags.json ? writeJson(response) : process.stderr.write(`Error: ${response.error.message}\nNext: ${response.error.remediation}\n`);
  }

  const frameworkRow = resolveFramework(flags.template);
  if (frameworkRow) {
    const { cmd, args } = buildC3Command(flags.packageManager, frameworkRow, appName);
    const result = spawnSync(cmd, args, { stdio: "inherit", cwd: USER_CWD });
    if (result.status !== 0) {
      process.stderr.write(`\nC3 scaffold failed (exit ${result.status}). See output above.\n`);
      await track("create_app_failed", telemetryProps(flags, { errorCode: "C3_SCAFFOLD_FAILED", exitCode: result.status ?? 1, durationMs: durationMs(startedAt) }));
      process.exit(result.status ?? 1);
    }
    const appDir = resolve(USER_CWD, appName);
    applyFrameworkHook(appDir, frameworkRow, flags.packageManager);
    process.stdout.write("\nNext steps:\n" + frameworkNextSteps(flags.packageManager, appName, frameworkRow).map((l) => `  ${l}`).join("\n") + "\n");
    await track("create_app_completed", telemetryProps(flags, { framework: true, durationMs: durationMs(startedAt) }));
    return;
  }

  let generatedFiles;
  let generatedModules;
  let planOnlyModules = [];
  let selectionWarnings = [];

  if (isRepoTemplate) {
    // Repo template: copy the bundled SvelteKit app verbatim, then patch names.
    const files = applyRepoTemplateConfig(await readRepoTemplateFiles(flags.template), appName, flags.config);
    generatedFiles = files;
    generatedModules = repoTemplateModules(files);
    if (flags.modules?.length) {
      selectionWarnings = [
        `Repo template ${flags.template} ships its module set; add others in-project with the microservices add command.`,
      ];
    }
  } else {
    const selection = moduleSelection(flags.modules);
    if (!selection.ok) {
      await track("create_app_failed", telemetryProps(flags, { errorCode: selection.response.error.code, durationMs: durationMs(startedAt) }));
      return flags.json
        ? writeJson(selection.response)
        : process.stderr.write(`Error: ${selection.response.error.message}\nNext: ${selection.response.error.remediation}\n`);
    }
    const response = generateProject({
      templateId: flags.template,
      modules: selection.generationModules.length ? selection.generationModules : undefined,
      config: {
        appName,
        appSlug: appName,
        ...(flags.config || {}),
      },
    });
    if (!response.ok) {
      await track("create_app_failed", telemetryProps(flags, { errorCode: response.error?.code ?? "GENERATE_FAILED", durationMs: durationMs(startedAt) }));
      return flags.json ? writeJson(response) : process.stderr.write(`Error: ${response.error.message}\n`);
    }
    generatedFiles = response.data.files;
    generatedModules = response.data.composition.modules.map((module) => module.id);
    planOnlyModules = selection.planOnlyModules;
    selectionWarnings = selection.warnings;
  }

  if (corporateOs) {
    generatedFiles = applyCorporateOsProfile(generatedFiles, corporateOs);
  }

  const { root, written } = await writeGeneratedFiles(targetDirectory, generatedFiles);
  const git = setupGit(root, flags.git ? flags.gitRepo : null);
  let installResult = null;

  if (flags.install) {
    const installStartedAt = Date.now();
    installResult = installDependencies(root, flags.packageManager);
    if ((installResult.status ?? 1) !== 0) {
      const output = fail(
        "INSTALL_FAILED",
        "Project files were written, but dependency installation failed.",
        `Run cd ${appName} and ${flags.packageManager} install.`,
        { appName, packageManager: flags.packageManager, root }
      );
      await track(
        "dependency_install_failed",
        telemetryProps(flags, { exitCode: installResult.status ?? 1, durationMs: durationMs(installStartedAt) })
      );
      await track("create_app_failed", telemetryProps(flags, { errorCode: "INSTALL_FAILED", durationMs: durationMs(startedAt) }));
      return flags.json ? writeJson(output) : process.stderr.write(`\n${output.error.message}\nNext: ${output.error.remediation}\n`);
    }
    await track(
      "dependency_install_completed",
      telemetryProps(flags, { durationMs: durationMs(installStartedAt) })
    );
  }

  const output = {
    ok: true,
    data: {
      appName,
      root,
      template: flags.template,
      modules: generatedModules,
      requestedModules: flags.modules ?? [],
      planOnlyModules,
      packageManager: flags.packageManager,
      installed: flags.install,
      git,
      written,
      nextCommands: nextCommands(flags.packageManager, appName, flags.install, planOnlyModules, flags.template),
      corporateOs: corporateOs
        ? {
            intake: "microservices.os.json",
            docs: [
              "docs/company-model.md",
              "docs/operating-map.md",
              "docs/research-sources.md",
              "docs/decision-briefs.md",
              "docs/pilot-plan.md",
            ],
          }
        : null,
    },
    warnings: [
      ...selectionWarnings,
      ...(flags.install ? [] : ["Dependencies were not installed. Run the install command before local dev."]),
    ],
  };

  await track("create_app_completed", {
    ...telemetryProps(flags),
    template: flags.template,
    modules: generatedModules,
    moduleCount: generatedModules.length,
    packageManager: flags.packageManager,
    installed: flags.install,
    corporateOs: Boolean(corporateOs),
    operatingLoop: corporateOs?.operatingLoop ?? null,
    durationMs: durationMs(startedAt),
  });

  if (flags.json) {
    writeJson(output);
    return;
  }

  process.stdout.write(`Created ${appName} in ${root}\n\n`);
  if (git.initialized) {
    process.stdout.write(`Git remote: ${git.remote}\n\n`);
  }
  process.stdout.write("Next commands:\n");
  process.stdout.write(output.data.nextCommands.map((command) => `  ${command}`).join("\n"));
  process.stdout.write("\n");
  if (corporateOs) {
    process.stdout.write("\nCorporate OS artifacts:\n");
    process.stdout.write(`  microservices.os.json\n`);
    process.stdout.write(output.data.corporateOs.docs.map((path) => `  ${path}`).join("\n"));
    process.stdout.write("\n");
  }
}

main().catch(async (error) => {
  const response = fail("CREATE_APP_FAILED", error.message, "Fix the input or choose an empty target directory.");
  if (!error?.telemetryTracked) {
    await track("create_app_failed", { code: "CREATE_APP_FAILED", version: PACKAGE_VERSION });
  }
  writeJson(response);
  process.exitCode = 1;
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Kept for bin-entry clarity; main is already invoked above.
}
