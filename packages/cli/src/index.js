#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { stdin as nodeStdin, stdout as nodeStdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { track, telemetryNotice } from "./telemetry.js";
import { buildHoneycomb, formatHoneycomb, formatIssues } from "./graph.js";
import {
  composeApp,
  checkUpdates,
  generateProject,
  getModuleDoc,
  getSecretsStatus,
  inspectModule,
  inspectTemplate,
  listModules,
  listModuleDocs,
  listTemplates,
  planAddModule,
  planDeploymentResources,
  planModuleUpgrade,
  runChecks,
  validateConfig,
} from "@microservices-sh/sdk-internal";

const USER_CWD = process.env.INIT_CWD || process.cwd();
const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_CONFIG_PATH = process.env.MICROSERVICES_CONFIG_PATH
  ? resolve(process.env.MICROSERVICES_CONFIG_PATH)
  : join(process.env.MICROSERVICES_CONFIG_DIR || join(homedir(), ".microservices"), "config.json");

function parseArgs(argv) {
  const args = [];
  const flags = {
    json: false,
    out: null,
    modules: null,
    config: null,
    apiUrl: process.env.MICROSERVICES_API_URL ?? null,
    actor: process.env.USER ?? "agent",
    name: null,
    subject: null,
    description: null,
    category: null,
    priority: null,
    contactEmail: null,
    contactName: null,
    projectId: null,
    deploymentId: null,
    pageUrl: null,
    url: null,
    hostname: null,
    apiKey: process.env.MICROSERVICES_API_KEY ?? process.env.MICROSERVICES_TOKEN ?? null,
    token: process.env.METRICS_TOKEN ?? null,
    environment: null,
    confirm: null,
    mode: null,
    validationMethod: null,
    cfCustomHostnameId: null,
    cfHostnameStatus: null,
    cfSslStatus: null,
    dir: null,
    fromReport: null,
    target: "cloudflare",
    goal: null,
    limit: null,
    d1: [],
    kv: [],
    agent: false,
    dryRun: false,
    plan: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    } else if (value === "--json") {
      flags.json = true;
    } else if (value === "--out") {
      flags.out = argv[index + 1];
      index += 1;
    } else if (value === "--modules") {
      flags.modules = argv[index + 1]?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
      index += 1;
    } else if (value === "--config") {
      try {
        flags.config = JSON.parse(argv[index + 1] ?? "{}");
      } catch (error) {
        throw new Error(`Invalid --config JSON: ${error.message}`);
      }
      index += 1;
    } else if (value === "--api-url") {
      flags.apiUrl = argv[index + 1];
      index += 1;
    } else if (value === "--actor") {
      flags.actor = argv[index + 1];
      index += 1;
    } else if (value === "--name") {
      flags.name = argv[index + 1];
      index += 1;
    } else if (value === "--subject") {
      flags.subject = argv[index + 1];
      index += 1;
    } else if (value === "--description" || value === "--message") {
      flags.description = argv[index + 1];
      index += 1;
    } else if (value === "--category") {
      flags.category = argv[index + 1];
      index += 1;
    } else if (value === "--priority") {
      flags.priority = argv[index + 1];
      index += 1;
    } else if (value === "--email" || value === "--contact-email") {
      flags.contactEmail = argv[index + 1];
      index += 1;
    } else if (value === "--contact-name") {
      flags.contactName = argv[index + 1];
      index += 1;
    } else if (value === "--project-id") {
      flags.projectId = argv[index + 1];
      index += 1;
    } else if (value === "--deployment-id") {
      flags.deploymentId = argv[index + 1];
      index += 1;
    } else if (value === "--page-url") {
      flags.pageUrl = argv[index + 1];
      index += 1;
    } else if (value === "--url") {
      flags.url = argv[index + 1];
      index += 1;
    } else if (value === "--hostname") {
      flags.hostname = argv[index + 1];
      index += 1;
    } else if (value === "--api-key") {
      flags.apiKey = argv[index + 1];
      index += 1;
    } else if (value === "--token") {
      flags.token = argv[index + 1];
      index += 1;
    } else if (value === "--env" || value === "--environment") {
      flags.environment = argv[index + 1];
      index += 1;
    } else if (value === "--confirm") {
      flags.confirm = argv[index + 1];
      index += 1;
    } else if (value === "--mode") {
      flags.mode = argv[index + 1];
      index += 1;
    } else if (value === "--validation-method") {
      flags.validationMethod = argv[index + 1];
      index += 1;
    } else if (value === "--cf-custom-hostname-id") {
      flags.cfCustomHostnameId = argv[index + 1];
      index += 1;
    } else if (value === "--cf-hostname-status") {
      flags.cfHostnameStatus = argv[index + 1];
      index += 1;
    } else if (value === "--cf-ssl-status") {
      flags.cfSslStatus = argv[index + 1];
      index += 1;
    } else if (value === "--dir") {
      flags.dir = argv[index + 1];
      index += 1;
    } else if (value === "--from-report") {
      flags.fromReport = argv[index + 1];
      index += 1;
    } else if (value === "--target") {
      flags.target = argv[index + 1];
      index += 1;
    } else if (value === "--goal") {
      flags.goal = argv[index + 1];
      index += 1;
    } else if (value === "--limit") {
      flags.limit = argv[index + 1];
      index += 1;
    } else if (value === "--d1") {
      flags.d1.push(argv[index + 1]);
      index += 1;
    } else if (value === "--kv") {
      flags.kv.push(argv[index + 1]);
      index += 1;
    } else if (value === "--agent") {
      flags.agent = true;
    } else if (value === "--dry-run") {
      flags.dryRun = true;
    } else if (value === "--plan") {
      flags.plan = true;
    } else {
      args.push(value);
    }
  }

  return { args, flags };
}

function templateInput(templateId, flags) {
  return {
    templateId: templateId || "booking-business",
    modules: flags.modules ?? undefined,
    config: flags.config ?? undefined,
  };
}

function cliTelemetryProps(flags, extra = {}) {
  return {
    source: "global-cli",
    json: flags.json,
    ...extra,
  };
}

function errorCode(response) {
  return response?.error?.code ?? (response?.ok === false ? "UNKNOWN_ERROR" : null);
}

async function trackResponse(successName, failureName, response, props = {}) {
  if (response?.ok === false) {
    await track(failureName, { ...props, result: "failed", errorCode: errorCode(response) });
    return;
  }
  await track(successName, { ...props, result: "completed" });
}

function failResponse(code, message, remediation, details = {}) {
  return {
    ok: false,
    requestId: `local_${Date.now().toString(36)}`,
    error: {
      code,
      message,
      remediation,
      details,
    },
  };
}

function writeJson(response) {
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}

function assertOk(response) {
  if (response.ok) return response.data;
  const error = new Error(response.error.message);
  error.response = response;
  throw error;
}

function printHuman(response, formatter) {
  if (!response.ok) {
    process.stderr.write(`Error: ${response.error.message}\n`);
    process.stderr.write(`Next: ${response.error.remediation}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(formatter(response.data));
  if (response.warnings?.length) {
    process.stdout.write(`\nWarnings:\n${response.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
  }
}

function usage() {
  return `microservices.sh CLI

Usage:
  microservices templates list [--json]
  microservices templates inspect <id> [--json]
  microservices modules list [--json]
  microservices modules inspect <id> [--json]
  microservices docs [module-id] [--json]
  microservices add <module-id> --plan [--mode embedded|service] [--json]
  microservices secrets status [--json]
  microservices updates [--json]
  microservices upgrade <module-id> --plan [--json]
  microservices compose [template-id] [--modules auth,customer,booking] [--config '{"appName":"Demo"}'] [--json]
  microservices graph [template-id] [--modules auth,customer,booking] [--json]
  microservices validate [template-id] [--config '{"timezone":"America/New_York"}'] [--json]
  microservices generate [template-id] --out <dir> [--json]
  microservices check [template-id] [--json]
  microservices auth login [--api-url https://api.microservices.sh] [--json]   # browser device-code login
  microservices auth login --api-key <key> [--api-url https://api.microservices.sh] [--json]
  microservices auth status [--json]
  microservices auth whoami [--json]
  microservices auth logout [--json]
  microservices billing plans [--api-url https://api.microservices.sh] [--json]
  microservices billing status [--api-url https://api.microservices.sh] [--api-key <key>] [--json]
  microservices billing usage [--api-url https://api.microservices.sh] [--api-key <key>] [--json]
  microservices usage [--api-url https://api.microservices.sh] [--api-key <key>] [--json]
  microservices support ticket [--subject "..."] [--description "..."] [--category bug|feature_request|account|billing|general|other] [--priority critical|high|medium|low] [--email owner@example.com] [--project-id <id>] [--deployment-id <id>] [--url <page-url>] [--json]
  microservices support tickets [--limit 25] [--json]
  microservices analyze <project-dir> --target cloudflare --agent [--json]
  microservices analyze checklist --target cloudflare [--out checklist.json] [--json]
  microservices analyze report <report.json> [--json]
  microservices doctor --from-report <report.json> [--json]
  microservices prompt next --from-report <report.json> [--goal cloudflare-enable|migrate-functions|migrate-storage-r2|ci-deploy|fix-blockers] [--out prompt.md] [--json]
  microservices doctor [--dir <artifact-dir>] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy dev [template-id] [--name "Studio Dev"] [--config '{"appName":"Demo"}'] [--api-url http://127.0.0.1:8787] [--api-key <key>] [--json]
  microservices deploy preview [template-id] [--name "Studio Demo"] [--config '{"appName":"Demo"}'] [--api-url http://127.0.0.1:8787] [--api-key <key>] [--json]
  microservices deploy production [template-id] --plan [--json]
  microservices deploy production [template-id] --confirm production [--name "Studio Prod"] [--api-url http://127.0.0.1:8787] [--api-key <key>] [--json]
  microservices deploy status <deployment-id> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy artifact <deployment-id> --out <dir> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy doctor [--dir <artifact-dir>] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy pipeline <deployment-id> --dir <artifact-dir> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy verify --dir <artifact-dir> [--json]
  microservices deploy bind <deployment-id> --dir <artifact-dir> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy bind --dir <artifact-dir> --d1 DB=<database-id> --kv CACHE_KV=<namespace-id> [--json]
  microservices deploy migrate <deployment-id> [--confirm migrate|production-migrate] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy migrate --dir <artifact-dir> [--plan] [--confirm migrate] [--json]
  microservices deploy migrate --dir <production-artifact-dir> [--confirm production-migrate] [--json]
  microservices deploy upload-plan <deployment-id> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy upload <deployment-id> [--plan] [--confirm upload|production-upload] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy upload --dir <artifact-dir> [--dry-run] [--plan] [--json]
  microservices deploy upload --dir <artifact-dir> --confirm upload [--json]
  microservices deploy upload --dir <production-artifact-dir> --confirm production-upload [--json]
  microservices deploy cleanup <deployment-id> [--plan] [--confirm cleanup|production-cleanup] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy activate <deployment-id> --url <worker-url> [--mode wrangler-local|dispatch-uploaded] [--confirm production] [--json]
  microservices deploy domain <deployment-id> --hostname app.customer.com [--validation-method txt] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy domain-refresh <deployment-id> --hostname app.customer.com [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy plan-resources [template-id] [--mode embedded|service] [--json]
  microservices deploy provision <deployment-id> [--confirm production] [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy resources <deployment-id> [--api-url http://127.0.0.1:8787] [--json]
  microservices deploy logs <deployment-id> [--api-url http://127.0.0.1:8787] [--json]
  microservices logs <deployment-id> [--api-url http://127.0.0.1:8787] [--json]
  microservices metrics [--api-url https://api.microservices.sh] [--token <METRICS_TOKEN>] [--json]
`;
}

async function readCliConfig() {
  try {
    const raw = await readFile(DEFAULT_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid CLI config JSON at ${DEFAULT_CONFIG_PATH}: ${error.message}`);
    }
    throw error;
  }
}

async function writeCliConfig(config) {
  await mkdir(dirname(DEFAULT_CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(DEFAULT_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

async function removeCliConfig() {
  await rm(DEFAULT_CONFIG_PATH, { force: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function redactToken(value) {
  if (!value) return null;
  if (value.length <= 10) return "configured";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function resolvedApiSettings(flags) {
  const config = await readCliConfig();
  return {
    apiUrl: flags.apiUrl ?? config.apiUrl ?? DEFAULT_API_URL,
    apiKey: flags.apiKey ?? config.apiKey ?? null,
    actor: flags.actor ?? config.actor ?? "agent",
    config,
  };
}

function formatTemplates(templates) {
  return `${templates
    .map((template) => `${template.id} (${template.version})\n  ${template.summary}\n  modules: ${template.defaultModules.join(", ")}`)
    .join("\n\n")}\n`;
}

function formatModules(modules) {
  return `${modules
    .map((module) => `${module.id} (${module.version}) at ${module.mount}\n  ${module.summary}`)
    .join("\n\n")}\n`;
}

function formatComposition(composition) {
  return `Composition: ${composition.compositionId}
Template: ${composition.template.name}
Modules: ${composition.modules.map((module) => module.id).join(", ")}
Routes: ${composition.routes.map((route) => `${route.mount} -> ${route.module}`).join(", ")}
Bindings: ${composition.bindings.join(", ")}
Hooks: ${composition.hooks.map((hook) => hook.name).join(", ")}
`;
}

async function writeGeneratedFiles(outputDirectory, files) {
  if (!outputDirectory) {
    throw new Error("Missing --out <dir> for generate.");
  }

  const root = resolve(USER_CWD, outputDirectory);
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

  return written;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const SUPPORT_CATEGORIES = new Set(["bug", "feature_request", "account", "billing", "general", "other"]);
const SUPPORT_PRIORITIES = new Set(["critical", "high", "medium", "low"]);
const SUPPORT_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeSupportChoice(value, allowed, fallback) {
  const normalized = optionalString(value)?.toLowerCase() ?? fallback;
  return allowed.has(normalized) ? normalized : null;
}

function canPrompt() {
  return Boolean(nodeStdin.isTTY && nodeStdout.isTTY);
}

async function supportTicketInput(flags) {
  let subject = optionalString(flags.subject);
  let description = optionalString(flags.description);
  let contactEmail = optionalString(flags.contactEmail);
  const missingRequired = [
    subject ? null : "--subject",
    description ? null : "--description",
  ].filter(Boolean);

  if (missingRequired.length && (flags.json || !canPrompt())) {
    return {
      ok: false,
      response: failResponse(
        "SUPPORT_TICKET_INPUT_REQUIRED",
        `Missing ${missingRequired.join(" and ")}.`,
        "Pass --subject and --description, or run `microservices support ticket` in an interactive terminal.",
        { missing: missingRequired }
      ),
    };
  }

  if ((!subject || !description || !contactEmail) && canPrompt() && !flags.json) {
    const rl = createInterface({ input: nodeStdin, output: nodeStdout });
    try {
      if (!subject) subject = optionalString(await rl.question("Subject: "));
      if (!description) description = optionalString(await rl.question("Description: "));
      if (!contactEmail) contactEmail = optionalString(await rl.question("Contact email: "));
    } finally {
      rl.close();
    }
  }

  if (!subject || !description) {
    return {
      ok: false,
      response: failResponse(
        "SUPPORT_TICKET_INPUT_REQUIRED",
        "subject and description are required.",
        "Pass --subject and --description, or answer both prompts.",
        {}
      ),
    };
  }

  if (contactEmail && !SUPPORT_EMAIL_RE.test(contactEmail.toLowerCase())) {
    return {
      ok: false,
      response: failResponse(
        "INVALID_SUPPORT_CONTACT",
        "A valid contact email is required when --email is provided.",
        "Pass a valid email address with --email owner@example.com.",
        {}
      ),
    };
  }

  const category = normalizeSupportChoice(flags.category, SUPPORT_CATEGORIES, "general");
  if (!category) {
    return {
      ok: false,
      response: failResponse(
        "INVALID_SUPPORT_CATEGORY",
        `Unsupported support category: ${flags.category}.`,
        `Use one of: ${Array.from(SUPPORT_CATEGORIES).join(", ")}.`,
        {}
      ),
    };
  }

  const priority = normalizeSupportChoice(flags.priority, SUPPORT_PRIORITIES, "medium");
  if (!priority) {
    return {
      ok: false,
      response: failResponse(
        "INVALID_SUPPORT_PRIORITY",
        `Unsupported support priority: ${flags.priority}.`,
        `Use one of: ${Array.from(SUPPORT_PRIORITIES).join(", ")}.`,
        {}
      ),
    };
  }

  return {
    ok: true,
    body: {
      subject,
      description,
      category,
      priority,
      contactEmail: contactEmail ? contactEmail.toLowerCase() : undefined,
      contactName: optionalString(flags.contactName) ?? undefined,
      projectId: optionalString(flags.projectId) ?? undefined,
      deploymentId: optionalString(flags.deploymentId) ?? undefined,
      pageUrl: optionalString(flags.pageUrl) ?? optionalString(flags.url) ?? undefined,
      metadata: {
        source: "microservices-cli",
      },
    },
  };
}

function favcrmTicketLabel(ticket) {
  if (ticket.favcrmTicketNumber) return `#${ticket.favcrmTicketNumber}`;
  return ticket.favcrmTicketId ?? "not synced";
}

function formatSupportTicketCreated(result) {
  return `Support ticket created
Ticket: ${result.id}
Status: ${result.status}
FavCRM: ${favcrmTicketLabel(result)}
`;
}

function formatSupportTicketList(result) {
  const tickets = Array.isArray(result.tickets) ? result.tickets : [];
  if (!tickets.length) return "No support tickets found.\n";

  return `${tickets
    .map((ticket) => {
      const createdAt = Number.isFinite(Number(ticket.createdAt))
        ? new Date(Number(ticket.createdAt)).toISOString()
        : "unknown";
      const error = ticket.errorCode
        ? `\n  Error: ${ticket.errorCode}${ticket.errorMessage ? ` - ${ticket.errorMessage}` : ""}`
        : "";
      return `${ticket.id} ${ticket.status} ${ticket.priority}/${ticket.category}
  FavCRM: ${favcrmTicketLabel(ticket)}
  Subject: ${ticket.subject}
  Created: ${createdAt}${error}`;
    })
    .join("\n\n")}\n`;
}

function formatBillingPlans(plans) {
  const items = Array.isArray(plans) ? plans : [];
  if (!items.length) return "No billing plans returned.\n";

  return `${items
    .map((plan) => {
      const cadence = plan.cadence ?? "";
      const popular = plan.popular ? " popular" : "";
      const mode = plan.selfServe ? "self-serve" : "contact us";
      const features = Array.isArray(plan.features) && plan.features.length
        ? `\n  ${plan.features.join("\n  ")}`
        : "";
      return `${plan.label} (${plan.id})${popular}
  Price: ${plan.price}${cadence}
  Mode:  ${mode}
  ${plan.tagline ?? ""}${features}`;
    })
    .join("\n\n")}\n`;
}

function formatBillingStatus(status) {
  const invoices = Array.isArray(status.invoices) ? status.invoices : [];
  const invoiceLines = invoices.length
    ? invoices.map((invoice) => `- ${invoice.label}: ${invoice.amount} (${invoice.status})`).join("\n")
    : "- none";
  return `Billing
Plan:      ${status.planLabel ?? status.planId ?? "unknown"}
Price:     ${status.priceLabel ?? "unknown"}
Status:    ${status.status ?? "unknown"}
Renewal:   ${status.renewalDate ?? "none"}
Canceling: ${status.cancelAtPeriodEnd ? "yes" : "no"}
Invoices:
${invoiceLines}
`;
}

function formatUsageStatus(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  if (!items.length) return "No usage data returned.\n";

  return `Usage
${items
  .map((item) => {
    const limit = item.limit === null || item.limit === undefined ? "unlimited" : item.limit;
    const unit = item.unit ? ` ${item.unit}` : "";
    return `- ${item.label}: ${item.used}${unit} / ${limit}${unit}`;
  })
  .join("\n")}
`;
}

function artifactDispatchNamespace(manifest, microservicesConfig) {
  const manifestNamespace = optionalString(manifest.dispatchNamespace);
  if (manifestNamespace) return manifestNamespace;

  const managedCloudflare = isObject(microservicesConfig.managedCloudflare)
    ? microservicesConfig.managedCloudflare
    : {};
  return optionalString(managedCloudflare.dispatchNamespace);
}

function safeArtifactPath(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    return null;
  }

  const target = resolve(root, normalize(relativePath));
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return target === root || target.startsWith(prefix) ? target : null;
}

async function writeDeploymentManifest(outputDirectory, manifest) {
  if (!outputDirectory) {
    throw new Error("Missing --out <dir> for deployment artifact.");
  }

  const root = resolve(USER_CWD, outputDirectory);
  const target = safeArtifactPath(root, "microservices.deployment.json");
  if (!target) {
    throw new Error("Refusing to write deployment manifest outside output directory.");
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return target;
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseJsonText(text, id, label, checks) {
  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed)) {
      checks.push({ id, status: "fail", message: `${label} must contain a JSON object.` });
      return {};
    }
    checks.push({ id, status: "pass", message: `${label} JSON parsed.` });
    return parsed;
  } catch (error) {
    checks.push({ id, status: "fail", message: `${label} has invalid JSON: ${error.message}` });
    return {};
  }
}

async function verifyArtifactFile(root, id, label, relativePath, checks) {
  const target = safeArtifactPath(root, relativePath);
  if (!target) {
    checks.push({ id, status: "fail", message: `${label} path is missing or escapes the artifact directory.` });
    return null;
  }

  const contents = await readOptionalText(target);
  if (contents === null) {
    checks.push({ id, status: "fail", message: `${label} is missing at ${relativePath}.` });
    return null;
  }

  checks.push({ id, status: "pass", message: `${label} exists at ${relativePath}.` });
  return contents;
}

function commandList(commands, dispatchNamespace = null) {
  if (!isObject(commands)) return [];
  const commandsList = Object.entries(commands)
    .filter((entry) => typeof entry[1] === "string" && entry[1])
    .map(([name, command]) => ({ name, command }));

  if (!dispatchNamespace) return commandsList;

  return commandsList.map((item) =>
    item.name === "deploy"
      ? { ...item, command: `pnpm exec wrangler deploy --dispatch-namespace ${dispatchNamespace}` }
      : item
  );
}

async function verifyDeploymentArtifact(directory) {
  if (!directory) {
    return failResponse(
      "ARTIFACT_DIR_REQUIRED",
      "Missing deployment artifact directory.",
      "Pass --dir <artifact-dir> or use microservices deploy verify <artifact-dir>.",
      {}
    );
  }

  const root = resolve(USER_CWD, directory);
  const manifestPath = resolve(root, "microservices.deployment.json");
  const manifestText = await readOptionalText(manifestPath);
  if (manifestText === null) {
    return failResponse(
      "ARTIFACT_MANIFEST_MISSING",
      `Deployment manifest not found at ${manifestPath}.`,
      "Export a prepared deployment with microservices deploy artifact <deployment-id> --out <dir>.",
      { directory: root, manifestPath }
    );
  }

  const checks = [];
  const manifest = parseJsonText(manifestText, "manifest-json", "manifest", checks);
  const entrypoint = typeof manifest.entrypoint === "string" ? manifest.entrypoint : "src/index.ts";
  const wranglerConfigPath =
    typeof manifest.wranglerConfigPath === "string" ? manifest.wranglerConfigPath : "wrangler.jsonc";

  const packageText = await verifyArtifactFile(root, "package-json", "package.json", "package.json", checks);
  const wranglerText = await verifyArtifactFile(
    root,
    "wrangler-config",
    "Wrangler config",
    wranglerConfigPath,
    checks
  );
  await verifyArtifactFile(root, "worker-entrypoint", "Worker entrypoint", entrypoint, checks);
  if (typeof manifest.schemaPath === "string") {
    await verifyArtifactFile(root, "schema", "D1 schema", manifest.schemaPath, checks);
  }

  const packageJson = packageText ? parseJsonText(packageText, "package-json-parse", "package.json", checks) : {};
  const wranglerConfig = wranglerText
    ? parseJsonText(wranglerText, "wrangler-json-parse", "Wrangler config", checks)
    : {};
  const microservicesConfigPath = safeArtifactPath(root, "microservices.config.json");
  const microservicesConfigText = microservicesConfigPath ? await readOptionalText(microservicesConfigPath) : null;
  const microservicesConfig = microservicesConfigText
    ? parseJsonText(microservicesConfigText, "microservices-config-parse", "microservices.config.json", checks)
    : {};
  const dispatchNamespace = artifactDispatchNamespace(manifest, microservicesConfig);
  const scripts = isObject(packageJson.scripts) ? packageJson.scripts : {};

  checks.push(
    typeof scripts.typecheck === "string"
      ? { id: "typecheck-command", status: "pass", message: `Typecheck command is configured: ${scripts.typecheck}.` }
      : { id: "typecheck-command", status: "fail", message: "package.json must define a typecheck script." }
  );
  checks.push(
    typeof scripts.deploy === "string"
      ? { id: "deploy-command", status: "pass", message: `Deploy command is configured: ${scripts.deploy}.` }
      : { id: "deploy-command", status: "fail", message: "package.json must define a deploy script." }
  );
  checks.push(
    wranglerConfig.main === entrypoint
      ? { id: "wrangler-entrypoint", status: "pass", message: `Wrangler main matches ${entrypoint}.` }
      : {
          id: "wrangler-entrypoint",
          status: "fail",
          message: `Wrangler main ${wranglerConfig.main ?? "missing"} does not match manifest entrypoint ${entrypoint}.`,
        }
  );

  const placeholderBindings = Array.isArray(manifest.placeholderBindings) ? manifest.placeholderBindings : [];
  checks.push(
    placeholderBindings.length
      ? {
          id: "binding-placeholders",
          status: "pending",
          message: `${placeholderBindings.length} binding placeholder(s) must be rewritten after provisioning.`,
        }
      : { id: "binding-placeholders", status: "pass", message: "No binding placeholders remain in the manifest." }
  );
  const uploadReadiness = isObject(manifest.uploadReadiness) ? manifest.uploadReadiness : {};
  checks.push(
    uploadReadiness.workerUploadAdapterReady === true || uploadReadiness.localWranglerUploadReady === true
      ? { id: "worker-upload-adapter", status: "pass", message: "Worker upload is available through this artifact." }
      : { id: "worker-upload-adapter", status: "pending", message: "Worker upload adapter is still pending." }
  );
  checks.push(
    dispatchNamespace
      ? {
          id: "dispatch-namespace",
          status: "pass",
          message: `Worker upload targets dispatch namespace ${dispatchNamespace}.`,
        }
      : {
          id: "dispatch-namespace",
          status: "pending",
          message: "No dispatch namespace configured; upload will target a standalone Worker.",
        }
  );

  const status = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "pending")
      ? "pending"
      : "pass";
  const commands = commandList(manifest.commands, dispatchNamespace);

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      directory: root,
      manifestPath,
      deploymentId: manifest.deploymentId ?? null,
      environment: manifest.environment ?? null,
      artifactId: manifest.artifactId ?? null,
      workerName: manifest.workerName ?? null,
      dispatchNamespace,
      status,
      checks,
      commands,
      nextSteps:
        status === "fail"
          ? ["Re-export the deployment artifact or restore the missing generated files."]
          : [
              ...commands.map((item) => item.command),
              placeholderBindings.length
                ? "Run deploy provision and rewrite generated binding placeholders before upload."
                : "Proceed to bundling/upload once the Worker upload adapter is available.",
            ],
    },
  };
}

async function deploymentPipelinePlan(deploymentId, directory, flags = {}) {
  if (!deploymentId) {
    return failResponse(
      "DEPLOYMENT_ID_REQUIRED",
      "Missing deployment id for pipeline plan.",
      "Pass deploy pipeline <deployment-id> --dir <artifact-dir>.",
      {}
    );
  }

  const verification = await verifyDeploymentArtifact(directory);
  if (!verification.ok) return verification;

  const environment = verification.data.environment ?? "preview";
  const production = environment === "production";
  const migrateConfirm = production ? "production-migrate" : "migrate";
  const uploadConfirm = production ? "production-upload" : "upload";
  const activateConfirm = production ? " --confirm production" : "";
  const artifactDir = directory;
  const deploymentArg = shellArg(deploymentId);
  const artifactDirArg = shellArg(artifactDir);
  const apiUrlArg = flags.apiUrl ? ` --api-url ${shellArg(flags.apiUrl)}` : "";

  const steps = [
    {
      id: "doctor",
      command: `microservices deploy doctor --dir ${artifactDirArg}${apiUrlArg}`,
      mutates: false,
      required: true,
    },
    {
      id: "status",
      command: `microservices deploy status ${deploymentArg}${apiUrlArg}`,
      mutates: false,
      required: true,
    },
    {
      id: "verify",
      command: `microservices deploy verify --dir ${artifactDirArg}`,
      mutates: false,
      required: true,
    },
    {
      id: "provision",
      command: `microservices deploy provision ${deploymentArg}${production ? " --confirm production" : ""}${apiUrlArg}`,
      mutates: true,
      required: true,
    },
    {
      id: "resources",
      command: `microservices deploy resources ${deploymentArg}${apiUrlArg}`,
      mutates: false,
      required: true,
    },
    {
      id: "upload-plan",
      command: `microservices deploy upload-plan ${deploymentArg}${apiUrlArg}`,
      mutates: false,
      required: true,
    },
    {
      id: "bind",
      command: `microservices deploy bind ${deploymentArg} --dir ${artifactDirArg}${apiUrlArg}`,
      mutates: true,
      required: true,
    },
    {
      id: "migrate-plan",
      command: `microservices deploy migrate --dir ${artifactDirArg} --plan`,
      mutates: false,
      required: true,
    },
    {
      id: "migrate",
      command: `microservices deploy migrate --dir ${artifactDirArg} --confirm ${migrateConfirm}`,
      mutates: true,
      required: true,
    },
    {
      id: "upload-dry-run",
      command: `microservices deploy upload --dir ${artifactDirArg} --dry-run`,
      mutates: false,
      required: true,
    },
    {
      id: "upload",
      command: `microservices deploy upload --dir ${artifactDirArg} --confirm ${uploadConfirm}`,
      mutates: true,
      required: true,
    },
    {
      id: "activate",
      command: `microservices deploy activate ${deploymentArg} --url "$WORKER_URL"${activateConfirm}${apiUrlArg}`,
      mutates: true,
      required: true,
    },
  ];

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      deploymentId,
      artifactDirectory: resolve(USER_CWD, artifactDir),
      apiUrl: flags.apiUrl ?? null,
      environment,
      workerName: verification.data.workerName,
      verificationStatus: verification.data.status,
      confirmations: {
        provision: production ? "production" : null,
        migrate: migrateConfirm,
        upload: uploadConfirm,
        activate: production ? "production" : null,
      },
      steps,
      nextSteps: [
        "Run the steps in order.",
        flags.apiUrl ? "Use auth login or MICROSERVICES_API_KEY for authenticated control-plane commands." : null,
        verification.data.dispatchNamespace
          ? "Set WORKER_URL to the dispatch router URL before activation."
          : "Set WORKER_URL to the URL returned by Wrangler deploy before activation.",
      ].filter(Boolean),
    },
  };
}

function shellArg(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function parseJsonObjectStrict(text, label) {
  const parsed = JSON.parse(text);
  if (!isObject(parsed)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return parsed;
}

const MIGRATION_SCHEMA_VERSION = "2026-06-15";
const MIGRATION_ANALYSIS_DIR = ".microservices/analysis";
const MIGRATION_TARGETS = new Set(["cloudflare"]);
const READINESS_STATUSES = new Set(["ready", "needs_changes", "blocked"]);
const FINDING_STATUSES = new Set(["pass", "warn", "blocker", "unknown", "not_applicable"]);
const REPORT_ARRAY_FIELDS = ["findings", "recommendedPlan", "requiredEnv", "suggestedBindings", "nextCommands"];
const NEXT_PROMPT_GOALS = new Set([
  "cloudflare-enable",
  "migrate-functions",
  "migrate-storage-r2",
  "ci-deploy",
  "fix-blockers",
]);

function normalizeMigrationTarget(value) {
  return optionalString(value)?.toLowerCase() ?? "cloudflare";
}

function migrationChecklist(target = "cloudflare") {
  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    id: "cloudflare-migration-checklist",
    target,
    outputReport: `${MIGRATION_ANALYSIS_DIR}/report.json`,
    statusValues: Array.from(FINDING_STATUSES),
    evidenceContract: {
      requiredFor: ["warn", "blocker"],
      shape: {
        file: "project-relative file path",
        line: "1-based line number when available",
        summary: "short factual evidence summary",
      },
    },
    sections: [
      {
        id: "project",
        title: "Project Identity",
        items: [
          "Detect framework, package manager, runtime, build scripts, output directory, and existing hosting config.",
          "Classify target mode as static-spa, worker-ssr, full-stack-worker, or hybrid.",
        ],
      },
      {
        id: "build",
        title: "Build Readiness",
        items: [
          "Find the production build command and whether it succeeds locally.",
          "Identify required adapters, SPA fallback behavior, headers, and asset cache rules.",
        ],
      },
      {
        id: "runtime",
        title: "Worker Runtime Compatibility",
        items: [
          "Check runtime use of fs, net, tls, child_process, native modules, local disk writes, and long-running servers.",
          "Separate browser-only or build-time Node imports from request-time server/runtime imports.",
        ],
      },
      {
        id: "environment",
        title: "Environment And Secrets",
        items: [
          "List public build env vars separately from server-only secrets.",
          "Flag any secret that appears in client code, docs, checked-in env files, or generated output.",
        ],
      },
      {
        id: "data",
        title: "Data Layer",
        items: [
          "Map relational databases to D1 or Hyperdrive, and explain why a direct D1 rewrite is or is not safe.",
          "Call out Supabase Auth/RLS, Prisma, Drizzle, Postgres functions, views, triggers, and migrations.",
        ],
      },
      {
        id: "auth",
        title: "Auth And Sessions",
        items: [
          "Identify auth provider, session storage, cookie settings, OAuth callbacks, admin roles, and edge compatibility.",
          "Preserve existing auth in phase 1 unless the report justifies a rewrite.",
        ],
      },
      {
        id: "storage",
        title: "Assets, Uploads, And Object Storage",
        items: [
          "Map static assets to Workers assets and user/generated uploads to R2.",
          "Identify signed URL, privacy, retention, and object-key migration requirements.",
        ],
      },
      {
        id: "functions",
        title: "Server Functions And APIs",
        items: [
          "Find Netlify/Vercel/Supabase/serverless functions and recommend same-origin Worker routes.",
          "Preserve authorization behavior and server-only secrets when moving functions.",
        ],
      },
      {
        id: "background",
        title: "Background Work",
        items: [
          "Map cron jobs, scheduled jobs, queues, webhooks, and long-running tasks to Cloudflare Cron Triggers, Queues, or Workflows.",
        ],
      },
      {
        id: "observability",
        title: "Observability And Smoke Tests",
        items: [
          "Identify health checks, error logging, deploy verification, and smoke tests needed before live traffic.",
        ],
      },
      {
        id: "ci",
        title: "CI And Deploy",
        items: [
          "Describe non-interactive deploy requirements for managed microservices.sh and user-owned Cloudflare.",
          "List required CI secrets without printing values.",
        ],
      },
      {
        id: "plan",
        title: "Staged Migration Plan",
        items: [
          "Prefer a working Cloudflare-hosted phase before deeper backend migrations.",
          "Return exact next commands and keep patch recommendations read-only unless explicitly asked to mutate.",
        ],
      },
    ],
  };
}

function migrationReportExample(project) {
  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    project: {
      name: project.name ?? "unknown",
      path: project.path,
      framework: project.framework ?? "unknown",
      packageManager: project.packageManager ?? "unknown",
    },
    target: {
      provider: "cloudflare",
      mode: "static-spa|worker-ssr|full-stack-worker|hybrid",
    },
    readiness: {
      status: "ready|needs_changes|blocked",
      score: 0,
    },
    findings: [
      {
        id: "build.static-spa",
        title: "Static SPA build",
        status: "pass|warn|blocker|unknown|not_applicable",
        confidence: "high|medium|low",
        evidence: [
          {
            file: "package.json",
            line: 1,
            summary: "Build script produces dist output.",
          },
        ],
        impact: "Why this matters for Cloudflare.",
        recommendation: "What to do next.",
        suggestedCloudflareService: "workers-assets",
      },
    ],
    recommendedPlan: [
      {
        id: "phase-1",
        title: "Cloudflare-enable hosting",
        summary: "Deploy frontend on Cloudflare while preserving the current backend.",
      },
    ],
    requiredEnv: [
      { name: "VITE_SUPABASE_URL", scope: "public-build", required: true },
      { name: "SUPABASE_SERVICE_ROLE_KEY", scope: "worker-secret", required: false },
    ],
    suggestedBindings: [
      { type: "r2", binding: "UPLOADS_BUCKET", reason: "Private uploaded audio files." },
    ],
    nextCommands: [
      "microservices doctor --from-report .microservices/analysis/report.json",
      "microservices prompt next --from-report .microservices/analysis/report.json --goal cloudflare-enable",
    ],
  };
}

async function assertExistingDirectory(root) {
  try {
    const info = await stat(root);
    if (!info.isDirectory()) {
      return failResponse(
        "PROJECT_PATH_NOT_DIRECTORY",
        `Project path is not a directory: ${root}.`,
        "Pass an existing project directory.",
        { path: root }
      );
    }
    return null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return failResponse(
        "PROJECT_PATH_NOT_FOUND",
        `Project path not found: ${root}.`,
        "Pass an existing project directory.",
        { path: root }
      );
    }
    throw error;
  }
}

async function projectMetadata(root) {
  const packageText = await readOptionalText(resolve(root, "package.json"));
  let packageJson = {};
  if (packageText) {
    try {
      packageJson = parseJsonObjectStrict(packageText, "package.json");
    } catch {
      packageJson = {};
    }
  }

  const scripts = isObject(packageJson.scripts) ? packageJson.scripts : {};
  const dependencies = {
    ...(isObject(packageJson.dependencies) ? packageJson.dependencies : {}),
    ...(isObject(packageJson.devDependencies) ? packageJson.devDependencies : {}),
  };
  const has = (name) => Object.prototype.hasOwnProperty.call(dependencies, name);
  const framework = has("@sveltejs/kit")
    ? "sveltekit"
    : has("next")
      ? "next"
      : has("astro")
        ? "astro"
        : has("react") && has("vite")
          ? "vite-react"
          : has("vite")
            ? "vite"
            : "unknown";
  const packageManager = (await readOptionalText(resolve(root, "pnpm-lock.yaml")))
    ? "pnpm"
    : (await readOptionalText(resolve(root, "package-lock.json")))
      ? "npm"
      : (await readOptionalText(resolve(root, "yarn.lock")))
        ? "yarn"
        : "unknown";

  return {
    name: optionalString(packageJson.name) ?? "unknown",
    path: root,
    framework,
    packageManager,
    buildCommand: optionalString(scripts.build) ?? null,
  };
}

function migrationAgentPrompt(project, target, checklistPath, reportPath) {
  const example = migrationReportExample(project);
  return `# Cloudflare Migration Analysis Agent Prompt

You are analyzing this existing project for Cloudflare migration readiness.

## Project
- Path: ${project.path}
- Detected name: ${project.name}
- Detected framework: ${project.framework}
- Detected package manager: ${project.packageManager}
- Detected build command: ${project.buildCommand ?? "unknown"}
- Target: ${target}

## Rules
- Do not mutate files unless the user explicitly asks for patches.
- Do not print, copy, or expose secret values.
- Use the checklist at \`${checklistPath}\`.
- Inspect package scripts, framework config, env vars, runtime imports, database, storage, auth, server functions, CI, and hosting config.
- Prefer staged migration. Do not recommend D1 for apps coupled to Supabase Auth/RLS or Postgres-specific behavior unless you explain the rewrite.
- Every blocker or warning must include project-relative file/line evidence when possible.
- Write only valid JSON to \`${reportPath}\`.

## Required Report Schema
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`
`;
}

async function writeMigrationAnalysis(projectDir, flags) {
  const target = normalizeMigrationTarget(flags.target);
  if (!MIGRATION_TARGETS.has(target)) {
    return failResponse(
      "MIGRATION_TARGET_UNSUPPORTED",
      `Unsupported migration target: ${target}.`,
      "Use --target cloudflare.",
      { target }
    );
  }

  const projectRoot = resolve(USER_CWD, projectDir || ".");
  const directoryError = await assertExistingDirectory(projectRoot);
  if (directoryError) return directoryError;

  const project = await projectMetadata(projectRoot);
  const analysisDir = resolve(projectRoot, MIGRATION_ANALYSIS_DIR);
  const checklistPath = resolve(analysisDir, "cloudflare-checklist.json");
  const promptPath = resolve(analysisDir, "agent-prompt.md");
  const reportPath = resolve(analysisDir, "report.json");
  const checklist = migrationChecklist(target);
  const prompt = migrationAgentPrompt(project, target, checklistPath, reportPath);

  await mkdir(analysisDir, { recursive: true });
  await writeFile(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  await writeFile(promptPath, prompt, "utf8");

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      project,
      target,
      agent: Boolean(flags.agent),
      analysisDir,
      checklistPath,
      promptPath,
      reportPath,
      nextSteps: [
        `Ask your coding agent to use ${promptPath} and write ${reportPath}.`,
        `Run microservices doctor --from-report ${shellArg(reportPath)}.`,
        `Run microservices prompt next --from-report ${shellArg(reportPath)} --goal cloudflare-enable.`,
      ],
    },
    warnings: flags.agent ? [] : ["No AI service was called; pass --agent to make the handoff explicit."],
  };
}

async function writeChecklistOnly(flags) {
  const target = normalizeMigrationTarget(flags.target);
  if (!MIGRATION_TARGETS.has(target)) {
    return failResponse(
      "MIGRATION_TARGET_UNSUPPORTED",
      `Unsupported migration target: ${target}.`,
      "Use --target cloudflare.",
      { target }
    );
  }

  const checklist = migrationChecklist(target);
  const outputPath = flags.out ? resolve(USER_CWD, flags.out) : null;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  }

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      checklist,
      outputPath,
    },
    warnings: [],
  };
}

function validateMigrationReport(report) {
  const errors = [];
  const warnings = [];
  const checks = [];

  const check = (id, ok, message, level = "error") => {
    checks.push({ id, status: ok ? "pass" : level === "warn" ? "warn" : "fail", message });
    if (ok) return;
    if (level === "warn") warnings.push(message);
    else errors.push(message);
  };

  check("schema-version", typeof report.schemaVersion === "string", "schemaVersion is required.");
  if (report.schemaVersion && report.schemaVersion !== MIGRATION_SCHEMA_VERSION) {
    warnings.push(`Report schemaVersion ${report.schemaVersion} differs from CLI schema ${MIGRATION_SCHEMA_VERSION}.`);
    checks.push({
      id: "schema-version-current",
      status: "warn",
      message: `Expected ${MIGRATION_SCHEMA_VERSION}; got ${report.schemaVersion}.`,
    });
  }
  check("project", isObject(report.project), "project must be an object.");
  check("target", isObject(report.target), "target must be an object.");
  check("readiness", isObject(report.readiness), "readiness must be an object.");
  const readinessStatus = report.readiness?.status;
  check(
    "readiness-status",
    READINESS_STATUSES.has(readinessStatus),
    `readiness.status must be one of ${Array.from(READINESS_STATUSES).join(", ")}.`
  );
  check(
    "readiness-score",
    Number.isFinite(report.readiness?.score) && report.readiness.score >= 0 && report.readiness.score <= 100,
    "readiness.score must be a number from 0 to 100."
  );

  for (const field of REPORT_ARRAY_FIELDS) {
    check(field, Array.isArray(report[field]), `${field} must be an array.`);
  }

  const findings = Array.isArray(report.findings) ? report.findings : [];
  findings.forEach((finding, index) => {
    const label = `findings[${index}]`;
    check(`${label}.object`, isObject(finding), `${label} must be an object.`);
    if (!isObject(finding)) return;
    check(`${label}.id`, typeof finding.id === "string" && Boolean(finding.id.trim()), `${label}.id is required.`);
    check(
      `${label}.status`,
      FINDING_STATUSES.has(finding.status),
      `${label}.status must be one of ${Array.from(FINDING_STATUSES).join(", ")}.`
    );
    if (finding.status === "warn" || finding.status === "blocker") {
      const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
      check(
        `${label}.evidence`,
        evidence.length > 0,
        `${label} has status ${finding.status} and must include file/line evidence.`
      );
      evidence.forEach((item, evidenceIndex) => {
        check(
          `${label}.evidence[${evidenceIndex}].file`,
          isObject(item) && typeof item.file === "string" && Boolean(item.file.trim()),
          `${label}.evidence[${evidenceIndex}].file is required for warnings/blockers.`
        );
      });
    }
  });

  return {
    status: errors.length ? "fail" : warnings.length ? "warn" : "pass",
    errors,
    warnings,
    checks,
  };
}

async function loadMigrationReport(reportPath) {
  if (!reportPath) {
    return {
      ok: false,
      response: failResponse(
        "MIGRATION_REPORT_REQUIRED",
        "Missing migration report path.",
        "Pass --from-report .microservices/analysis/report.json.",
        {}
      ),
    };
  }

  const resolvedPath = resolve(USER_CWD, reportPath);
  const reportText = await readOptionalText(resolvedPath);
  if (reportText === null) {
    return {
      ok: false,
      response: failResponse(
        "MIGRATION_REPORT_NOT_FOUND",
        `Migration report not found at ${resolvedPath}.`,
        "Ask your agent to write the report, then retry.",
        { reportPath: resolvedPath }
      ),
    };
  }

  try {
    const report = parseJsonObjectStrict(reportText, "migration report");
    return { ok: true, report, reportPath: resolvedPath };
  } catch (error) {
    return {
      ok: false,
      response: failResponse(
        "MIGRATION_REPORT_INVALID_JSON",
        `Migration report is invalid JSON: ${error.message}`,
        "Ask your agent to write only valid JSON to the report path.",
        { reportPath: resolvedPath }
      ),
    };
  }
}

async function migrationReportValidation(reportPath) {
  const loaded = await loadMigrationReport(reportPath);
  if (!loaded.ok) return loaded.response;

  const validation = validateMigrationReport(loaded.report);
  return {
    ok: validation.status !== "fail",
    requestId: `local_${Date.now().toString(36)}`,
    ...(validation.status === "fail"
      ? {
          error: {
            code: "MIGRATION_REPORT_SCHEMA_INVALID",
            message: "Migration report failed schema validation.",
            remediation: "Fix report.json using the generated checklist and agent prompt.",
            details: { errors: validation.errors },
          },
        }
      : {}),
    data: {
      reportPath: loaded.reportPath,
      status: validation.status,
      checks: validation.checks,
      warnings: validation.warnings,
      report: loaded.report,
    },
    warnings: validation.warnings,
  };
}

function migrationDoctorStatus(report, validation) {
  if (validation.status === "fail") return "fail";
  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (report.readiness?.status === "blocked" || findings.some((finding) => finding.status === "blocker")) {
    return "fail";
  }
  if (report.readiness?.status === "needs_changes" || findings.some((finding) => finding.status === "warn")) {
    return "warn";
  }
  return "pass";
}

async function migrationDoctorFromReport(reportPath) {
  const loaded = await loadMigrationReport(reportPath);
  if (!loaded.ok) return loaded.response;

  const validation = validateMigrationReport(loaded.report);
  const status = migrationDoctorStatus(loaded.report, validation);
  const findings = Array.isArray(loaded.report.findings) ? loaded.report.findings : [];
  const blockers = findings.filter((finding) => finding.status === "blocker");
  const warningFindings = findings.filter((finding) => finding.status === "warn");
  const nextSteps = Array.isArray(loaded.report.nextCommands) && loaded.report.nextCommands.length
    ? loaded.report.nextCommands
    : [
        `microservices prompt next --from-report ${shellArg(loaded.reportPath)} --goal ${status === "fail" ? "fix-blockers" : "cloudflare-enable"}`,
      ];

  return {
    ok: validation.status !== "fail" && status !== "fail",
    requestId: `local_${Date.now().toString(36)}`,
    ...(validation.status === "fail" || status === "fail"
      ? {
          error: {
            code: validation.status === "fail" ? "MIGRATION_REPORT_SCHEMA_INVALID" : "MIGRATION_DOCTOR_BLOCKED",
            message:
              validation.status === "fail"
                ? "Migration report failed schema validation."
                : "Migration doctor found blockers.",
            remediation:
              validation.status === "fail"
                ? "Fix report.json using the generated checklist and agent prompt."
                : "Generate a fix-blockers prompt or resolve the listed blockers.",
            details: {
              validationErrors: validation.errors,
              blockers: blockers.map((finding) => finding.id),
            },
          },
        }
      : {}),
    data: {
      reportPath: loaded.reportPath,
      status,
      validation,
      project: loaded.report.project ?? {},
      target: loaded.report.target ?? {},
      readiness: loaded.report.readiness ?? {},
      blockers,
      warnings: warningFindings,
      recommendedPlan: Array.isArray(loaded.report.recommendedPlan) ? loaded.report.recommendedPlan : [],
      requiredEnv: Array.isArray(loaded.report.requiredEnv) ? loaded.report.requiredEnv : [],
      suggestedBindings: Array.isArray(loaded.report.suggestedBindings) ? loaded.report.suggestedBindings : [],
      nextSteps,
    },
    warnings: validation.warnings,
  };
}

function evidenceLabel(finding) {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const first = evidence.find(isObject);
  if (!first?.file) return "no evidence";
  return `${first.file}${Number.isInteger(first.line) ? `:${first.line}` : ""}`;
}

function formatMigrationDoctor(result) {
  const blockers = result.blockers.length
    ? result.blockers.map((finding) => `- ${finding.id}: ${finding.title ?? finding.recommendation ?? "blocker"} (${evidenceLabel(finding)})`).join("\n")
    : "- none";
  const warnings = result.warnings.length
    ? result.warnings.map((finding) => `- ${finding.id}: ${finding.title ?? finding.recommendation ?? "warning"} (${evidenceLabel(finding)})`).join("\n")
    : "- none";
  const bindings = result.suggestedBindings.length
    ? result.suggestedBindings
        .map((binding) => `- ${binding.type ?? "binding"} ${binding.binding ?? binding.name ?? "unnamed"}: ${binding.reason ?? ""}`.trim())
        .join("\n")
    : "- none";
  const env = result.requiredEnv.length
    ? result.requiredEnv
        .map((item) => `- ${item.name ?? "unnamed"} (${item.scope ?? "unknown"}${item.required === false ? ", optional" : ""})`)
        .join("\n")
    : "- none";

  return `Migration doctor: ${result.status}
Project: ${result.project.name ?? "unknown"}
Path: ${result.project.path ?? "unknown"}
Target: ${result.target.provider ?? "cloudflare"} / ${result.target.mode ?? "unknown"}
Readiness: ${result.readiness.status ?? "unknown"} (${result.readiness.score ?? "?"}/100)

Blockers:
${blockers}

Warnings:
${warnings}

Suggested bindings:
${bindings}

Required env:
${env}

Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`;
}

function defaultNextPromptGoal(report) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (findings.some((finding) => finding.status === "blocker")) return "fix-blockers";
  if (findings.some((finding) => String(finding.id ?? "").includes("function"))) return "migrate-functions";
  if (findings.some((finding) => String(finding.id ?? "").includes("storage"))) return "migrate-storage-r2";
  return "cloudflare-enable";
}

function reportSummaryForPrompt(report) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const blockers = findings.filter((finding) => finding.status === "blocker").map((finding) => finding.id);
  const warnings = findings.filter((finding) => finding.status === "warn").map((finding) => finding.id);
  return {
    project: report.project ?? {},
    target: report.target ?? {},
    readiness: report.readiness ?? {},
    blockers,
    warnings,
  };
}

function nextAgentPrompt(report, goal) {
  const summary = reportSummaryForPrompt(report);
  const sharedRules = `## Rules
- Do not expose secret values.
- Keep changes scoped to this goal.
- Preserve current behavior unless the report explicitly marks it unsafe.
- Include file/line references in your final summary.
- Run the smallest relevant build/check command and report the result.
- Do not deploy or mutate Cloudflare resources unless the user explicitly approves side effects.
`;

  const goalBody = {
    "fix-blockers": `Goal: resolve the migration blockers from the report before any deploy attempt.

Use the report blockers as the source of truth. Apply the smallest safe patches, then update or ask the user to update the report findings that changed.`,
    "cloudflare-enable": `Goal: Cloudflare-enable the app without a deep backend migration.

Add or adjust Cloudflare deploy config for the detected app mode. Preserve existing backend providers such as Supabase, Neon, Firebase, or external APIs unless the report explicitly says they must move. Preserve SPA fallbacks, asset caching, security headers, and public build env vars.`,
    "migrate-functions": `Goal: migrate existing serverless/edge functions to Cloudflare Worker routes.

Preserve route behavior, auth checks, CORS behavior, and server-only secrets. Prefer same-origin /api routes for frontend calls. Keep the original backend database/auth provider unless a separate data migration has been approved.`,
    "migrate-storage-r2": `Goal: plan and implement the next safe R2 migration slice.

Separate public assets, private uploads, signed URLs, and metadata rows. Move object storage behind Worker routes when privacy or signed URL behavior is required. Do not delete existing storage objects in this pass.`,
    "ci-deploy": `Goal: make the Cloudflare deploy workflow CI-ready.

Document required non-interactive commands and secrets. Support managed microservices.sh deploy and user-owned Cloudflare deploy modes. Do not print token values.`,
  }[goal];

  return `# Next Agent Prompt: ${goal}

${goalBody}

## Report Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

${sharedRules}
`;
}

function nextPromptFileName(goal) {
  const order = {
    "fix-blockers": "000",
    "cloudflare-enable": "001",
    "migrate-functions": "002",
    "migrate-storage-r2": "003",
    "ci-deploy": "004",
  }[goal] ?? "999";
  return `${order}-${goal}.md`;
}

async function writeNextPromptFromReport(reportPath, flags) {
  const loaded = await loadMigrationReport(reportPath);
  if (!loaded.ok) return loaded.response;

  const validation = validateMigrationReport(loaded.report);
  if (validation.status === "fail") {
    return failResponse(
      "MIGRATION_REPORT_SCHEMA_INVALID",
      "Migration report failed schema validation.",
      "Fix report.json before generating next prompts.",
      { errors: validation.errors }
    );
  }

  const goal = optionalString(flags.goal) ?? defaultNextPromptGoal(loaded.report);
  if (!NEXT_PROMPT_GOALS.has(goal)) {
    return failResponse(
      "MIGRATION_PROMPT_GOAL_INVALID",
      `Unsupported prompt goal: ${goal}.`,
      `Use one of: ${Array.from(NEXT_PROMPT_GOALS).join(", ")}.`,
      { goal }
    );
  }

  const prompt = nextAgentPrompt(loaded.report, goal);
  const promptPath = flags.out
    ? resolve(USER_CWD, flags.out)
    : resolve(dirname(loaded.reportPath), "prompts", nextPromptFileName(goal));
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, prompt, "utf8");

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      goal,
      reportPath: loaded.reportPath,
      promptPath,
      nextSteps: [`Ask your coding agent to use ${promptPath}.`, "Re-run microservices doctor --from-report after the agent reports changes."],
    },
    warnings: validation.warnings,
  };
}

function formatAnalyzeCreated(result) {
  return `Agent analysis files created
Project: ${result.project.path}
Checklist: ${result.checklistPath}
Prompt: ${result.promptPath}
Report target: ${result.reportPath}

Ask your coding agent:
"Use ${result.promptPath} and write the report to ${result.reportPath}"

Then:
- microservices doctor --from-report ${shellArg(result.reportPath)}
- microservices prompt next --from-report ${shellArg(result.reportPath)}
`;
}

function formatChecklistResult(result) {
  return result.outputPath
    ? `Checklist written to ${result.outputPath}\n`
    : `Checklist: ${result.checklist.id} (${result.checklist.schemaVersion})\nSections:\n${result.checklist.sections.map((section) => `- ${section.id}: ${section.title}`).join("\n")}\n`;
}

function formatReportValidation(result) {
  return `Migration report validation: ${result.status}
Report: ${result.reportPath}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
`;
}

function formatNextPromptResult(result) {
  return `Next agent prompt: ${result.goal}
Prompt: ${result.promptPath}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`;
}

async function readMutableArtifactManifest(directory) {
  if (!directory) {
    return {
      ok: false,
      response: failResponse(
        "ARTIFACT_DIR_REQUIRED",
        "Missing deployment artifact directory.",
        "Pass --dir <artifact-dir>.",
        {}
      ),
    };
  }

  const root = resolve(USER_CWD, directory);
  const manifestPath = safeArtifactPath(root, "microservices.deployment.json");
  if (!manifestPath) {
    return {
      ok: false,
      response: failResponse(
        "ARTIFACT_PATH_INVALID",
        "Deployment manifest path escapes the artifact directory.",
        "Pass a normal artifact directory path.",
        { directory: root }
      ),
    };
  }

  const manifestText = await readOptionalText(manifestPath);
  if (manifestText === null) {
    return {
      ok: false,
      response: failResponse(
        "ARTIFACT_MANIFEST_MISSING",
        `Deployment manifest not found at ${manifestPath}.`,
        "Export a prepared deployment with microservices deploy artifact <deployment-id> --out <dir>.",
        { directory: root, manifestPath }
      ),
    };
  }

  try {
    return {
      ok: true,
      root,
      manifestPath,
      manifest: parseJsonObjectStrict(manifestText, "Deployment manifest"),
    };
  } catch (error) {
    return {
      ok: false,
      response: failResponse(
        "ARTIFACT_MANIFEST_INVALID",
        error.message,
        "Re-export the deployment artifact or repair microservices.deployment.json.",
        { directory: root, manifestPath }
      ),
    };
  }
}

function parseResourceAssignments(flags) {
  const parseAssignment = (resourceType, value) => {
    if (typeof value !== "string" || !value.includes("=")) {
      throw new Error(`Invalid --${resourceType} assignment. Use BINDING=<id>.`);
    }
    const [binding, ...rest] = value.split("=");
    const externalId = rest.join("=").trim();
    if (!binding.trim() || !externalId) {
      throw new Error(`Invalid --${resourceType} assignment. Use BINDING=<id>.`);
    }
    return {
      resourceType,
      binding: binding.trim(),
      externalId,
      status: "created",
      name: binding.trim(),
    };
  };

  return [
    ...flags.d1.map((value) => parseAssignment("d1", value)),
    ...flags.kv.map((value) => parseAssignment("kv", value)),
  ];
}

function updateManifestBindings(manifest, applied) {
  const appliedByKey = new Map(applied.map((item) => [`${item.resourceType}:${item.binding}`, item.externalId]));
  const bindings = Array.isArray(manifest.bindings) ? manifest.bindings.filter(isObject) : [];

  for (const binding of bindings) {
    const externalId = appliedByKey.get(`${binding.type}:${binding.binding}`);
    if (!externalId) continue;

    if (binding.type === "d1") {
      binding.databaseId = externalId;
    } else if (binding.type === "kv") {
      binding.id = externalId;
    }
    binding.placeholder = false;
  }

  if (bindings.length) {
    manifest.bindings = bindings;
    manifest.placeholderBindings = bindings.filter((binding) => binding.placeholder === true);
  }

  const uploadReadiness = isObject(manifest.uploadReadiness) ? manifest.uploadReadiness : {};
  manifest.uploadReadiness = {
    ...uploadReadiness,
    needsResourceBindingRewrite: Array.isArray(manifest.placeholderBindings)
      ? manifest.placeholderBindings.length > 0
      : false,
  };
  manifest.updatedAt = new Date().toISOString();
}

async function bindDeploymentArtifact(directory, resources, source) {
  const loaded = await readMutableArtifactManifest(directory);
  if (!loaded.ok) return loaded.response;

  const { root, manifestPath, manifest } = loaded;
  const wranglerConfigPath =
    typeof manifest.wranglerConfigPath === "string" ? manifest.wranglerConfigPath : "wrangler.jsonc";
  const wranglerPath = safeArtifactPath(root, wranglerConfigPath);
  if (!wranglerPath) {
    return failResponse(
      "WRANGLER_PATH_INVALID",
      "Wrangler config path escapes the artifact directory.",
      "Re-export the deployment artifact or repair microservices.deployment.json.",
      { directory: root, wranglerConfigPath }
    );
  }

  const wranglerText = await readOptionalText(wranglerPath);
  if (wranglerText === null) {
    return failResponse(
      "WRANGLER_CONFIG_MISSING",
      `Wrangler config not found at ${wranglerPath}.`,
      "Re-export the deployment artifact or restore wrangler.jsonc.",
      { directory: root, wranglerPath }
    );
  }

  let wranglerConfig;
  try {
    wranglerConfig = parseJsonObjectStrict(wranglerText, "Wrangler config");
  } catch (error) {
    return failResponse(
      "WRANGLER_CONFIG_INVALID",
      error.message,
      "Re-export the deployment artifact or repair wrangler.jsonc.",
      { directory: root, wranglerPath }
    );
  }

  const applied = [];
  const skipped = [];
  let workerNameApplied = false;
  const workerResource = resources.find(
    (resource) => resource.resourceType === "worker" && typeof resource.name === "string" && resource.name.trim() !== ""
  );
  const targetWorkerName = workerResource?.name?.trim() || (typeof manifest.workerName === "string" ? manifest.workerName.trim() : "");

  if (targetWorkerName) {
    if (wranglerConfig.name !== targetWorkerName) {
      wranglerConfig.name = targetWorkerName;
      manifest.workerName = targetWorkerName;
      workerNameApplied = true;
    }
  }

  for (const resource of resources) {
    if (!["d1", "kv"].includes(resource.resourceType)) {
      continue;
    }

    if (resource.status !== "created" || !resource.externalId) {
      skipped.push({
        resourceType: resource.resourceType,
        binding: resource.binding,
        reason: "resource-not-created",
      });
      continue;
    }

    const entries =
      resource.resourceType === "d1"
        ? Array.isArray(wranglerConfig.d1_databases)
          ? wranglerConfig.d1_databases.filter(isObject)
          : []
        : Array.isArray(wranglerConfig.kv_namespaces)
          ? wranglerConfig.kv_namespaces.filter(isObject)
          : [];
    const entry = entries.find((item) => item.binding === resource.binding);
    if (!entry) {
      skipped.push({
        resourceType: resource.resourceType,
        binding: resource.binding,
        reason: "binding-not-found",
      });
      continue;
    }

    if (resource.resourceType === "d1") {
      entry.database_id = resource.externalId;
    } else {
      entry.id = resource.externalId;
    }

    applied.push({
      resourceType: resource.resourceType,
      binding: resource.binding,
      externalId: resource.externalId,
    });
  }

  updateManifestBindings(manifest, applied);
  await writeFile(wranglerPath, `${JSON.stringify(wranglerConfig, null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const remainingPlaceholders = Array.isArray(manifest.placeholderBindings)
    ? manifest.placeholderBindings.length
    : 0;
  const status =
    applied.length === 0 && !workerNameApplied ? "unchanged" : remainingPlaceholders > 0 ? "partial" : "bound";

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      directory: root,
      manifestPath,
      wranglerPath,
      source,
      status,
      workerName: typeof wranglerConfig.name === "string" ? wranglerConfig.name : null,
      workerNameApplied,
      applied,
      skipped,
      remainingPlaceholders,
      nextSteps: [
        "Run deploy verify --dir <artifact-dir>.",
        remainingPlaceholders > 0
          ? "Provision or provide the remaining binding ids before upload."
          : "Proceed to bundling/upload once the Worker upload adapter is available.",
      ],
    },
  };
}

function failedUploadPreflight(verification) {
  if (!verification?.ok) return verification;

  const failedChecks = verification.data.checks.filter((check) => check.status === "fail");
  if (failedChecks.length) {
    return failResponse(
      "ARTIFACT_VERIFICATION_FAILED",
      "Deployment artifact verification failed.",
      "Fix the failed checks or re-export the deployment artifact.",
      { checks: failedChecks }
    );
  }

  const placeholderCheck = verification.data.checks.find((check) => check.id === "binding-placeholders");
  if (placeholderCheck?.status === "pending") {
    return failResponse(
      "ARTIFACT_BINDINGS_NOT_READY",
      "Deployment artifact still has resource binding placeholders.",
      "Run deploy provision and deploy bind, or pass explicit --d1/--kv ids to deploy bind.",
      { check: placeholderCheck }
    );
  }

  return null;
}

function appendCommandOutput(current, chunk) {
  const next = `${current}${chunk.toString()}`;
  return next.length > 65536 ? next.slice(-65536) : next;
}

function runCommand(command, args, cwd) {
  return new Promise((resolveCommand) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout = appendCommandOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendCommandOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      resolveCommand({ exitCode: 127, stdout, stderr: error.message });
    });
    child.on("close", (exitCode) => {
      resolveCommand({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

async function checkCommand(id, command, args, cwd = USER_CWD) {
  const result = await runCommand(command, args, cwd);
  return {
    id,
    status: result.exitCode === 0 ? "pass" : "fail",
    message:
      result.exitCode === 0
        ? `${command} ${args.join(" ")} is available.`
        : `${command} ${args.join(" ")} failed or is unavailable.`,
    details: {
      command: [command, ...args].join(" "),
      exitCode: result.exitCode,
      stdout: result.stdout.trim().slice(-2000),
      stderr: result.stderr.trim().slice(-2000),
    },
  };
}

async function runDoctor(flags) {
  const settings = await resolvedApiSettings(flags);
  const checks = [
    {
      id: "cli-config",
      status: settings.apiKey ? "pass" : "warn",
      message: settings.apiKey
        ? `API key is configured at ${DEFAULT_CONFIG_PATH}.`
        : "No API key is configured; commands only work when the API has auth disabled or --api-key is passed.",
      details: {
        apiUrl: settings.apiUrl,
        configPath: DEFAULT_CONFIG_PATH,
        actor: settings.actor,
        token: redactToken(settings.apiKey),
      },
    },
  ];

  try {
    const auth = await apiRequest(flags, "/auth/status");
    if (auth.ok && auth.data?.authRequired === false && !settings.apiKey) {
      checks[0] = {
        ...checks[0],
        status: "pass",
        message: "API auth is disabled; no local API key is required.",
      };
    }
    checks.push({
      id: "api-auth",
      status: auth.ok ? "pass" : "fail",
      message: auth.ok
        ? `API reachable and auth mode is ${auth.data?.mode ?? "unknown"}.`
        : auth.error?.message ?? "API auth status failed.",
      details: auth.ok ? auth.data : auth.error ?? {},
    });
  } catch (error) {
    checks.push({
      id: "api-auth",
      status: "fail",
      message: error.message,
      details: { apiUrl: settings.apiUrl },
    });
  }

  checks.push(await checkCommand("node", "node", ["--version"]));
  checks.push(await checkCommand("pnpm", "pnpm", ["--version"]));
  checks.push(await checkCommand("wrangler", "pnpm", ["exec", "wrangler", "--version"]));

  const artifactDirectory = flags.dir ?? null;
  if (artifactDirectory) {
    const verification = await verifyDeploymentArtifact(artifactDirectory);
    checks.push({
      id: "artifact",
      status: verification.ok ? doctorArtifactStatus(verification.data.status) : "fail",
      message: verification.ok
        ? `Deployment artifact verification is ${verification.data.status}.`
        : verification.error.message,
      details: verification.ok ? verification.data : verification.error,
    });
  } else {
    checks.push({
      id: "artifact",
      status: "skip",
      message: "No artifact directory provided; pass --dir <artifact-dir> to check deploy artifact readiness.",
      details: {},
    });
  }

  const status = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "pass";

  return {
    ok: status !== "fail",
    requestId: `local_${Date.now().toString(36)}`,
    ...(status === "fail"
      ? {
          error: {
            code: "DOCTOR_CHECKS_FAILED",
            message: "One or more doctor checks failed.",
            remediation: "Review data.checks and data.nextSteps before retrying the workflow.",
            details: {
              failedChecks: checks.filter((check) => check.status === "fail").map((check) => check.id),
            },
          },
        }
      : {}),
    data: {
      status,
      apiUrl: settings.apiUrl,
      artifactDirectory: artifactDirectory ? resolve(USER_CWD, artifactDirectory) : null,
      checks,
      nextSteps: doctorNextSteps(status, checks),
    },
  };
}

function doctorArtifactStatus(status) {
  if (status === "fail") return "fail";
  if (status === "pending") return "warn";
  return "pass";
}

function doctorNextSteps(status, checks) {
  if (status === "pass") {
    return ["Proceed with deploy pipeline, migrate, upload, or activation as needed."];
  }

  const steps = checks
    .filter((check) => check.status === "fail" || check.status === "warn")
    .map((check) => {
      if (check.id === "cli-config") return "Run microservices auth login --api-key <key> for authenticated APIs.";
      if (check.id === "api-auth") return "Start the API locally, set --api-url, or configure a valid API key.";
      if (check.id === "wrangler") return "Install dependencies and verify Wrangler with pnpm exec wrangler --version.";
      if (check.id === "artifact" && check.status === "fail") {
        return "Export or fix the deployment artifact, then run deploy verify --dir <artifact-dir>.";
      }
      if (check.id === "artifact") {
        return "Review pending artifact checks before upload; run deploy verify --dir <artifact-dir> for full detail.";
      }
      return `Fix ${check.id}.`;
    });

  return [...new Set(steps)];
}

async function markArtifactUploaded(directory, upload) {
  const loaded = await readMutableArtifactManifest(directory);
  if (!loaded.ok) return;

  if (upload.dispatchNamespace) {
    loaded.manifest.dispatchNamespace = upload.dispatchNamespace;
  }

  const uploadReadiness = isObject(loaded.manifest.uploadReadiness) ? loaded.manifest.uploadReadiness : {};
  loaded.manifest.uploadReadiness = {
    ...uploadReadiness,
    workerUploadAdapterReady: true,
  };
  loaded.manifest.lastUpload = upload;
  loaded.manifest.updatedAt = new Date().toISOString();
  await writeFile(loaded.manifestPath, `${JSON.stringify(loaded.manifest, null, 2)}\n`, "utf8");
}

async function uploadDeploymentArtifact(directory, flags) {
  const verification = await verifyDeploymentArtifact(directory);
  const preflightError = failedUploadPreflight(verification);
  if (preflightError) return preflightError;

  const root = verification.data.directory;
  const requiredConfirmation =
    verification.data.environment === "production" ? "production-upload" : "upload";
  const liveUpload = flags.confirm === requiredConfirmation && !flags.dryRun;
  const dryRun = !liveUpload;
  const command = "pnpm";
  const dispatchNamespace = verification.data.dispatchNamespace;
  const args = [
    "exec",
    "wrangler",
    "deploy",
    ...(dispatchNamespace ? ["--dispatch-namespace", dispatchNamespace] : []),
    ...(dryRun ? ["--dry-run"] : []),
  ];
  const upload = {
    command,
    args,
    cwd: root,
    dryRun,
    dispatchNamespace,
    confirmationRequired: dryRun ? requiredConfirmation : null,
  };

  if (flags.plan) {
    return {
      ok: true,
      requestId: `local_${Date.now().toString(36)}`,
      data: {
        status: "planned",
        verification: verification.data,
        upload,
        nextSteps: [
          dryRun
            ? "Run without --plan to execute the dry-run upload check."
            : "Run without --plan to upload the Worker with Wrangler.",
        ],
      },
    };
  }

  const result = await runCommand(command, args, root);
  const status = result.exitCode === 0 ? (dryRun ? "dry-run-passed" : "uploaded") : "failed";

  if (result.exitCode === 0 && !dryRun) {
    await markArtifactUploaded(directory, {
      status,
      command: [command, ...args].join(" "),
      dispatchNamespace,
      completedAt: new Date().toISOString(),
    });
  }

  return {
    ok: result.exitCode === 0,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      status,
      upload,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      nextSteps:
        result.exitCode === 0
          ? [
              dryRun
                ? `Run deploy upload --dir <artifact-dir> --confirm ${requiredConfirmation} to publish the Worker.`
                : dispatchNamespace
                  ? "Use the dispatch router URL for activation; do not activate a standalone workers.dev URL."
                  : "Inspect Wrangler output for the deployed Worker URL.",
            ]
          : [
              "Install generated project dependencies if missing.",
              "Run deploy verify --dir <artifact-dir>.",
              "Check Wrangler authentication with wrangler whoami.",
            ],
    },
    ...(result.exitCode === 0
      ? {}
      : {
          error: {
            code: "WRANGLER_DEPLOY_FAILED",
            message: dryRun ? "Wrangler deploy dry-run failed." : "Wrangler deploy failed.",
            remediation: "Review stdout/stderr, install dependencies, and check Cloudflare authentication.",
            details: { exitCode: result.exitCode },
          },
        }),
  };
}

function d1MigrationTargets(wranglerConfig) {
  const databases = Array.isArray(wranglerConfig.d1_databases)
    ? wranglerConfig.d1_databases.filter(isObject)
    : [];
  return databases
    .map((database) => ({
      binding: typeof database.binding === "string" ? database.binding : "DB",
      databaseName: typeof database.database_name === "string" ? database.database_name : null,
      databaseId: typeof database.database_id === "string" ? database.database_id : null,
    }))
    .filter((database) => database.databaseName);
}

function hasPlaceholderResourceId(value) {
  return typeof value !== "string" || !value.trim() || value.startsWith("REPLACE_WITH");
}

async function markArtifactMigrated(directory, migration) {
  const loaded = await readMutableArtifactManifest(directory);
  if (!loaded.ok) return;

  loaded.manifest.lastMigration = migration;
  loaded.manifest.updatedAt = new Date().toISOString();
  await writeFile(loaded.manifestPath, `${JSON.stringify(loaded.manifest, null, 2)}\n`, "utf8");
}

async function migrateDeploymentArtifact(directory, flags) {
  const verification = await verifyDeploymentArtifact(directory);
  const preflightError = failedUploadPreflight(verification);
  if (preflightError) return preflightError;

  const loaded = await readMutableArtifactManifest(directory);
  if (!loaded.ok) return loaded.response;

  const { root, manifest } = loaded;
  const schemaPath = typeof manifest.schemaPath === "string" ? manifest.schemaPath : "schema.sql";
  const schemaFile = safeArtifactPath(root, schemaPath);
  if (!schemaFile || (await readOptionalText(schemaFile)) === null) {
    return failResponse(
      "SCHEMA_FILE_MISSING",
      `D1 schema file not found at ${schemaPath}.`,
      "Re-export the deployment artifact or restore schema.sql.",
      { directory: root, schemaPath }
    );
  }

  const wranglerConfigPath =
    typeof manifest.wranglerConfigPath === "string" ? manifest.wranglerConfigPath : "wrangler.jsonc";
  const wranglerPath = safeArtifactPath(root, wranglerConfigPath);
  const wranglerText = wranglerPath ? await readOptionalText(wranglerPath) : null;
  if (wranglerText === null) {
    return failResponse(
      "WRANGLER_CONFIG_MISSING",
      `Wrangler config not found at ${wranglerConfigPath}.`,
      "Re-export the deployment artifact or restore wrangler.jsonc.",
      { directory: root, wranglerConfigPath }
    );
  }

  let wranglerConfig;
  try {
    wranglerConfig = parseJsonObjectStrict(wranglerText, "Wrangler config");
  } catch (error) {
    return failResponse(
      "WRANGLER_CONFIG_INVALID",
      error.message,
      "Re-export the deployment artifact or repair wrangler.jsonc.",
      { directory: root, wranglerConfigPath }
    );
  }

  const targets = d1MigrationTargets(wranglerConfig);
  if (!targets.length) {
    return failResponse(
      "D1_DATABASE_NOT_CONFIGURED",
      "No D1 database targets were found in wrangler.jsonc.",
      "Provision and bind D1 resources before running remote migrations.",
      { directory: root, wranglerConfigPath }
    );
  }

  const unboundTargets = targets.filter((target) => hasPlaceholderResourceId(target.databaseId));
  if (unboundTargets.length) {
    return failResponse(
      "D1_BINDINGS_NOT_READY",
      "One or more D1 targets still have placeholder database ids.",
      "Run deploy provision and deploy bind, or pass explicit --d1 ids to deploy bind.",
      {
        directory: root,
        targets: unboundTargets.map((target) => ({ binding: target.binding, databaseName: target.databaseName })),
      }
    );
  }

  const requiredConfirmation =
    verification.data.environment === "production" ? "production-migrate" : "migrate";
  const commands = targets.map((target) => ({
    target,
    command: "pnpm",
    args: ["exec", "wrangler", "d1", "execute", target.databaseName, "--remote", "--file", schemaPath],
    cwd: root,
  }));

  if (flags.plan) {
    return {
      ok: true,
      requestId: `local_${Date.now().toString(36)}`,
      data: {
        status: "planned",
        verification: verification.data,
        confirmationRequired: requiredConfirmation,
        commands,
        nextSteps: [
          `Run deploy migrate --dir <artifact-dir> --confirm ${requiredConfirmation} to apply the remote schema.`,
        ],
      },
    };
  }

  if (flags.confirm !== requiredConfirmation) {
    return failResponse(
      "MIGRATION_CONFIRMATION_REQUIRED",
      "Remote D1 migration requires explicit confirmation.",
      `Pass --confirm ${requiredConfirmation} after reviewing the generated schema and target database.`,
      {
        directory: root,
        confirmationRequired: requiredConfirmation,
        commands,
      }
    );
  }

  const results = [];
  for (const item of commands) {
    const result = await runCommand(item.command, item.args, item.cwd);
    results.push({ ...item, ...result });
    if (result.exitCode !== 0) {
      return {
        ok: false,
        requestId: `local_${Date.now().toString(36)}`,
        error: {
          code: "D1_MIGRATION_FAILED",
          message: `Remote D1 schema execution failed for ${item.target.binding}.`,
          remediation: "Review stdout/stderr, check Wrangler authentication, and verify the D1 database binding.",
          details: { binding: item.target.binding, exitCode: result.exitCode },
        },
        data: {
          status: "failed",
          results,
          nextSteps: [
            "Run deploy verify --dir <artifact-dir>.",
            "Check Wrangler authentication with wrangler whoami.",
            "Confirm the D1 database id in wrangler.jsonc.",
          ],
        },
      };
    }
  }

  await markArtifactMigrated(directory, {
    status: "migrated",
    targets: targets.map((target) => ({
      binding: target.binding,
      databaseName: target.databaseName,
      databaseId: target.databaseId,
    })),
    schemaPath,
    completedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      status: "migrated",
      schemaPath,
      results,
      nextSteps: ["Run deploy upload --dir <artifact-dir> --dry-run before publishing the Worker."],
    },
  };
}

function apiUrl(baseUrl, path) {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("Missing --api-url or MICROSERVICES_API_URL.");
  }
  return `${base}${path}`;
}

async function apiRequest(flags, path, options = {}) {
  const settings = await resolvedApiSettings(flags);
  const target = apiUrl(settings.apiUrl, path);
  const authHeader = settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};
  let response;
  try {
    response = await fetch(target, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    const cause = error.cause?.message ? ` (${error.cause.message})` : "";
    throw new Error(`Failed to reach API at ${target}: ${error.message}${cause}`);
  }

  const payload = await response.json().catch(() => ({
    ok: false,
    error: {
      message: `Non-JSON response from API with status ${response.status}.`,
    },
  }));

  if (!response.ok && payload && typeof payload === "object") {
    payload.httpStatus = response.status;
  }

  return payload;
}

function printApiHuman(response, formatter = () => "") {
  if (!response?.ok) {
    const message = response?.error?.message ?? "API request failed.";
    const code = response?.error?.code;
    let remediation = response?.error?.remediation;
    if (!remediation && (response?.httpStatus === 401 || code === "UNAUTHORIZED")) {
      remediation = "Run `microservices auth login` to authenticate.";
    }
    process.stderr.write(`Error: ${message}\n`);
    if (remediation) {
      process.stderr.write(`Next: ${remediation}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(formatter(response.data));
  if (response.warnings?.length) {
    process.stdout.write(`\nWarnings:\n${response.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
  }
}

/** Render the shared success result for both `auth login` paths (api-key + device). */
function emitLoginResult(flags, settings, apiKey, server, warnings) {
  const response = {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      apiUrl: settings.apiUrl,
      actor: settings.actor,
      configPath: DEFAULT_CONFIG_PATH,
      token: redactToken(apiKey),
      server: server ?? null,
    },
    warnings,
  };
  return flags.json
    ? writeJson(response)
    : printHuman(
        response,
        (result) => `Logged in for ${result.apiUrl}\nToken: ${result.token}\nConfig: ${result.configPath}\n`
      );
}

function productionDeployPlan(templateId, flags) {
  const input = templateInput(templateId, flags);
  return {
    ok: true,
    requestId: `local_${Date.now().toString(36)}`,
    data: {
      environment: "production",
      action: "deploy-production",
      approvalRequired: true,
      confirmationRequired: "production",
      templateId: input.templateId,
      modules: input.modules ?? "template-defaults",
      config: input.config ?? {},
      checksRequired: [
        "microservices check --json",
        "typecheck/build command from the generated project",
        "preview deployment must be ready before promotion",
      ],
      sideEffects: [
        "create or update production Worker",
        "bind production D1/KV resources",
        "run production migrations",
        "apply production secrets and environment variables",
        "attach production route or custom domain",
      ],
      nextSteps: [
        "Run checks locally.",
        "Deploy and verify a preview first.",
        "Review production secrets and migrations.",
        "Run deploy production --confirm production after approval to prepare the production artifact.",
      ],
    },
    warnings: [
      "This command is an approval plan only; production artifact preparation requires --confirm production, and later resource/migration/upload steps have separate confirmation gates.",
    ],
  };
}

function formatPreparedDeployment(result, label) {
  return `${label}: ${result.deployment.id}
Environment: ${result.deployment.environment}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Project: ${result.project.id}
Artifact: ${result.artifact.id}
Preview URL: ${result.deployment.previewUrl ?? "not provisioned yet"}
Next: ${result.nextSteps.join(" ")}
`;
}

function formatDomainRoute(result) {
  const route = result.route ?? {};
  const dns = result.dns ?? {};
  return `Custom domain: ${route.hostname ?? dns.hostname}
Deployment: ${result.deployment.id}
Status: ${route.status ?? "unknown"}
Worker: ${route.workerName ?? result.deployment.workerName ?? "unknown"}
CNAME: ${dns.recommended?.name ?? route.hostname} -> ${dns.recommended?.target ?? route.dnsTarget}
Cloudflare DNS: ${dns.cloudflareDns?.proxied ? "proxied" : "DNS only"} CNAME to ${dns.cloudflareDns?.target ?? route.dnsTarget}
External DNS: CNAME to ${dns.externalDnsProvider?.target ?? route.dnsTarget}
Apex note: ${dns.apex?.note ?? "Use subdomains unless apex support is configured."}
Next: ${result.nextSteps.join(" ")}
`;
}

function formatRemoteMigration(result) {
  const migration = result.migration ?? { applied: [], appliedCount: 0, skippedCount: 0 };
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Remote migrations: ${migration.appliedCount} applied, ${migration.skippedCount} skipped
${migration.applied.length ? migration.applied.map((item) => `- ${item.name}: ${item.status}`).join("\n") : "none"}
Next: ${result.nextSteps.join(" ")}
`;
}

function formatRemoteCleanup(result) {
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Cleanup:
${result.cleanup?.length ? result.cleanup.map((item) => `- ${item.resource.resourceType}/${item.resource.binding}: ${item.status}`).join("\n") : "none"}
`;
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const [resource, action, value] = args;
  let response;

  if (!resource || resource === "help" || resource === "--help" || resource === "-h") {
    process.stdout.write(usage());
    return;
  }

  telemetryNotice(flags.json);

  if (resource === "auth" && action === "login") {
    const loginStartedAt = Date.now();
    const settings = await resolvedApiSettings(flags);
    const method = settings.apiKey ? "api_key" : "device";
    await track("auth_login_started", cliTelemetryProps(flags, { method }));

    // Path A — explicit API key (agent-friendly, non-interactive): validate + save.
    if (settings.apiKey) {
      const warnings = [];
      let status = null;
      try {
        status = await apiRequest(flags, "/auth/status");
        if (!status.ok) {
          await track(
            "auth_login_failed",
            cliTelemetryProps(flags, { method, errorCode: errorCode(status), durationMs: Date.now() - loginStartedAt })
          );
          return flags.json ? writeJson(status) : printApiHuman(status);
        }
      } catch (error) {
        warnings.push(`Saved credentials without server validation: ${error.message}`);
      }

      await writeCliConfig({
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        actor: settings.actor,
        updatedAt: new Date().toISOString(),
      });

      await track(
        "auth_login_completed",
        cliTelemetryProps(flags, { method, validated: Boolean(status?.ok), durationMs: Date.now() - loginStartedAt })
      );
      return emitLoginResult(flags, settings, settings.apiKey, status?.data ?? null, warnings);
    }

    // Path B — interactive device-code login (no key): approve in a browser.
    const start = await apiRequest(flags, "/auth/device/start", { method: "POST", body: "{}" });
    if (!start.ok) {
      await track(
        "auth_login_failed",
        cliTelemetryProps(flags, { method, phase: "device_start", errorCode: errorCode(start), durationMs: Date.now() - loginStartedAt })
      );
      return flags.json ? writeJson(start) : printApiHuman(start);
    }
    const { userCode, deviceCode, verificationUri, interval, expiresIn } = start.data;

    // Progress goes to stderr so --json keeps a clean stdout for the final result.
    process.stderr.write(
      `\nTo finish signing in, open this URL and enter the code:\n\n  ${verificationUri}\n  code: ${userCode}\n\nWaiting for approval (Ctrl-C to cancel)...\n`
    );

    const deadline = Date.now() + (Number(expiresIn) || 900) * 1000;
    let pollMs = (Number(interval) || 5) * 1000;
    let apiKey = null;
    let failure = null;
    while (Date.now() < deadline) {
      await sleep(pollMs);
      let poll;
      try {
        poll = await apiRequest(flags, "/auth/device/poll", { method: "POST", body: JSON.stringify({ deviceCode }) });
      } catch (error) {
        process.stderr.write(`  (retrying: ${error.message})\n`);
        continue;
      }
      if (poll.ok && poll.data?.status === "approved") {
        apiKey = poll.data.apiKey;
        break;
      }
      if (poll.ok && poll.data?.status === "pending") {
        if (poll.data.interval) pollMs = poll.data.interval * 1000;
        continue;
      }
      const code = poll.error?.code;
      if (code === "slow_down") {
        pollMs += 2000;
        continue;
      }
      if (code === "denied" || code === "expired" || code === "already_claimed") {
        failure = code;
        break;
      }
      // unknown transient state — keep waiting until the deadline
    }

    if (!apiKey) {
      response = failResponse(
        failure ? `DEVICE_${failure.toUpperCase()}` : "DEVICE_TIMEOUT",
        failure ? `Login ${failure.replace(/_/g, " ")}.` : "Login timed out before approval.",
        "Run microservices auth login again."
      );
      await track(
        "auth_login_failed",
        cliTelemetryProps(flags, { method, phase: "device_poll", errorCode: response.error.code, durationMs: Date.now() - loginStartedAt })
      );
      return flags.json ? writeJson(response) : printApiHuman(response);
    }

    await writeCliConfig({
      apiUrl: settings.apiUrl,
      apiKey,
      actor: settings.actor,
      updatedAt: new Date().toISOString(),
    });

    const warnings = [];
    let status = null;
    try {
      status = await apiRequest(flags, "/auth/status"); // reads the key just written
      if (!status.ok) warnings.push("Saved key but server validation failed.");
    } catch (error) {
      warnings.push(`Saved key without server validation: ${error.message}`);
    }

    await track(
      "auth_login_completed",
      cliTelemetryProps(flags, { method, validated: Boolean(status?.ok), durationMs: Date.now() - loginStartedAt })
    );
    return emitLoginResult(flags, settings, apiKey, status?.ok ? status.data : null, warnings);
  }

  if (resource === "auth" && action === "status") {
    const settings = await resolvedApiSettings(flags);
    const warnings = [];
    let server = null;
    try {
      server = await apiRequest(flags, "/auth/status");
    } catch (error) {
      warnings.push(`Could not reach auth status endpoint: ${error.message}`);
    }

    response = {
      ok: true,
      requestId: `local_${Date.now().toString(36)}`,
      data: {
        apiUrl: settings.apiUrl,
        configPath: DEFAULT_CONFIG_PATH,
        configured: Boolean(settings.apiKey),
        token: redactToken(settings.apiKey),
        server: server?.ok ? server.data : null,
        serverError: server && !server.ok ? server.error : null,
      },
      warnings,
    };
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `API: ${result.apiUrl}
Token: ${result.configured ? result.token : "not configured"}
Server auth: ${result.server ? (result.server.authenticated ? "authenticated" : "not authenticated") : "unknown"}
Config: ${result.configPath}
`
        );
  }

  if (resource === "auth" && action === "logout") {
    await removeCliConfig();
    response = {
      ok: true,
      requestId: `local_${Date.now().toString(36)}`,
      data: {
        configPath: DEFAULT_CONFIG_PATH,
        loggedOut: true,
      },
      warnings: [],
    };
    return flags.json
      ? writeJson(response)
      : printHuman(response, (result) => `Logged out. Removed ${result.configPath}\n`);
  }

  if (resource === "auth" && action === "whoami") {
    const settings = await resolvedApiSettings(flags);
    let server = null;
    try {
      server = await apiRequest(flags, "/auth/status");
    } catch (error) {
      response = failResponse("API_UNREACHABLE", `Could not reach API: ${error.message}`, "Check --api-url and network.");
      return flags.json ? writeJson(response) : printApiHuman(response, () => "");
    }
    if (!server.ok || !server.data?.authenticated) {
      response = failResponse("UNAUTHENTICATED", "Not signed in.", "Run `microservices auth login`.");
      return flags.json ? writeJson(response) : printApiHuman(response, () => "");
    }
    response = {
      ok: true,
      requestId: `local_${Date.now().toString(36)}`,
      data: {
        apiUrl: settings.apiUrl,
        mode: server.data.mode,
        workspaceId: server.data.workspaceId,
        scopes: server.data.scopes ?? [],
        internal: Boolean(server.data.internal),
      },
      warnings: [],
    };
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Workspace: ${result.workspaceId ?? "—"}
Mode:      ${result.mode}
Scopes:    ${result.scopes.length ? result.scopes.join(", ") : "—"}
API:       ${result.apiUrl}
`
        );
  }

  if (resource === "billing") {
    if (!action || action === "status") {
      response = await apiRequest(flags, "/billing/status");
      return flags.json ? writeJson(response) : printApiHuman(response, formatBillingStatus);
    }

    if (action === "plans" || action === "plan") {
      response = await apiRequest(flags, "/billing/plans");
      return flags.json ? writeJson(response) : printApiHuman(response, formatBillingPlans);
    }

    if (action === "usage") {
      response = await apiRequest(flags, "/usage");
      return flags.json ? writeJson(response) : printApiHuman(response, formatUsageStatus);
    }

    response = failResponse(
      "UNKNOWN_BILLING_COMMAND",
      `Unknown billing command: ${action}.`,
      "Use `microservices billing plans`, `microservices billing status`, or `microservices billing usage`.",
      { command: action }
    );
    return flags.json ? writeJson(response) : printHuman(response, () => "");
  }

  if (resource === "usage") {
    response = await apiRequest(flags, "/usage");
    return flags.json ? writeJson(response) : printApiHuman(response, formatUsageStatus);
  }

  if (resource === "support" && (action === "ticket" || action === "create")) {
    const input = await supportTicketInput(flags);
    if (!input.ok) {
      return flags.json ? writeJson(input.response) : printHuman(input.response, () => "");
    }

    response = await apiRequest(flags, "/support/tickets", {
      method: "POST",
      body: JSON.stringify(input.body),
    });

    if (flags.json) return writeJson(response);
    if (!response?.ok) {
      printApiHuman(response, () => "");
      if (response?.error?.ticketId) {
        process.stderr.write(`Local ticket: ${response.error.ticketId}\n`);
      }
      return;
    }
    return printApiHuman(response, formatSupportTicketCreated);
  }

  if (resource === "support" && (action === "tickets" || action === "list")) {
    const limit = flags.limit === null ? 25 : Number(flags.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      response = failResponse(
        "INVALID_SUPPORT_LIMIT",
        "--limit must be an integer between 1 and 100.",
        "Pass --limit 25 or omit it.",
        {}
      );
      return flags.json ? writeJson(response) : printHuman(response, () => "");
    }

    const params = new URLSearchParams({ limit: String(limit) });
    response = await apiRequest(flags, `/support/tickets?${params.toString()}`);
    return flags.json ? writeJson(response) : printApiHuman(response, formatSupportTicketList);
  }

  if (resource === "analyze" && action === "checklist") {
    response = await writeChecklistOnly(flags);
    if (!response.ok) {
      process.exitCode = 1;
    }
    return flags.json ? writeJson(response) : printHuman(response, formatChecklistResult);
  }

  if (resource === "analyze" && action === "report") {
    response = await migrationReportValidation(value);
    if (!response.ok) {
      process.exitCode = 1;
    }
    return flags.json ? writeJson(response) : printHuman(response, formatReportValidation);
  }

  if (resource === "analyze") {
    response = await writeMigrationAnalysis(action || ".", flags);
    if (!response.ok) {
      process.exitCode = 1;
    }
    return flags.json ? writeJson(response) : printHuman(response, formatAnalyzeCreated);
  }

  if (resource === "prompt" && action === "next") {
    response = await writeNextPromptFromReport(flags.fromReport ?? value, flags);
    if (!response.ok) {
      process.exitCode = 1;
    }
    return flags.json ? writeJson(response) : printHuman(response, formatNextPromptResult);
  }

  if ((resource === "doctor" || (resource === "deploy" && action === "doctor")) && flags.fromReport) {
    response = await migrationDoctorFromReport(flags.fromReport);
    if (!response.ok) {
      process.exitCode = 1;
    }
    if (flags.json) return writeJson(response);
    if (response.data) {
      process.stdout.write(formatMigrationDoctor(response.data));
      return;
    }
    return printHuman(response, () => "");
  }

  if (resource === "doctor" || (resource === "deploy" && action === "doctor")) {
    response = await runDoctor(flags);
    if (!response.ok) {
      process.exitCode = 1;
    }
    if (flags.json) return writeJson(response);
    const result = response.data;
    process.stdout.write(`Doctor: ${result.status}
API: ${result.apiUrl}
Artifact: ${result.artifactDirectory ?? "not checked"}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`);
    return;
  }

  if (resource === "templates" && action === "list") {
    response = listTemplates();
    return flags.json ? writeJson(response) : printHuman(response, formatTemplates);
  }

  if (resource === "templates" && action === "inspect") {
    response = inspectTemplate(value);
    return flags.json ? writeJson(response) : printHuman(response, (template) => `${template.name}\n${template.summary}\nDefault modules: ${template.defaultModules.join(", ")}\nOptional modules: ${template.optionalModules.join(", ")}\n`);
  }

  if (resource === "modules" && action === "list") {
    response = listModules();
    return flags.json ? writeJson(response) : printHuman(response, formatModules);
  }

  if (resource === "modules" && action === "inspect") {
    response = inspectModule(value);
    return flags.json ? writeJson(response) : printHuman(response, (module) => `${module.name}\n${module.summary}\nMount: ${module.runtime.mount}\nRequires: ${module.requires.join(", ") || "none"}\nHooks: ${module.hooks.map((hook) => hook.name).join(", ")}\n`);
  }

  if (resource === "docs") {
    response = action ? getModuleDoc(action) : listModuleDocs();
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) =>
            Array.isArray(result)
              ? `${result.map((item) => `${item.id} (${item.status}) -> ${item.docPath}`).join("\n")}\n`
              : result.markdown
        );
  }

  if (resource === "add") {
    if (!flags.plan) {
      response = {
        ok: false,
        requestId: `local_${Date.now().toString(36)}`,
        error: {
          code: "PLAN_REQUIRED",
          message: "Module add is plan-only in the MVP scaffold.",
          remediation: "Run microservices add <module-id> --plan --json.",
          details: { moduleId: action },
        },
      };
      await track(
        "module_add_plan_failed",
        cliTelemetryProps(flags, { moduleId: action ?? null, mode: flags.mode ?? null, errorCode: response.error.code })
      );
      return flags.json
        ? writeJson(response)
        : printHuman(response, () => "");
    }
    response = planAddModule({ moduleId: action, mode: flags.mode, ...templateInput("booking-business", flags) });
    // Intent signal: which modules users want to add after scaffolding.
    // Plan-only in the MVP, so this is "planned", not "installed".
    if (response?.ok !== false) {
      await track("module_add_planned", cliTelemetryProps(flags, { moduleId: action, mode: flags.mode ?? null }));
    } else {
      await track(
        "module_add_plan_failed",
        cliTelemetryProps(flags, { moduleId: action ?? null, mode: flags.mode ?? null, errorCode: errorCode(response) })
      );
    }
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (plan) => `Plan for ${plan.module.id}: ${plan.action}\nApproval required: ${plan.approvalRequired}\nSecrets: ${plan.requiredSecrets.join(", ") || "none"}\nResources: ${plan.requiredResources.join(", ") || "none"}\n`
        );
  }

  if (resource === "secrets" && action === "status") {
    response = getSecretsStatus(templateInput(value || "booking-business", flags));
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `${result.secrets.map((item) => `${item.module}:${item.name} configured=${item.configured}`).join("\n") || "No required secrets for selected modules."}\n`
        );
  }

  if (resource === "updates") {
    response = checkUpdates(templateInput(action || "booking-business", flags));
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `${result.current.map((item) => `${item.id}: ${item.currentVersion} -> ${item.latestVersion} (${item.status})`).join("\n") || "No locked modules."}\n`
        );
  }

  if (resource === "upgrade") {
    if (!flags.plan) {
      response = {
        ok: false,
        requestId: `local_${Date.now().toString(36)}`,
        error: {
          code: "PLAN_REQUIRED",
          message: "Module upgrade is plan-only in the MVP scaffold.",
          remediation: "Run microservices upgrade <module-id> --plan --json.",
          details: { moduleId: action },
        },
      };
      return flags.json ? writeJson(response) : printHuman(response, () => "");
    }
    response = planModuleUpgrade({ moduleId: action, ...templateInput("booking-business", flags) });
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (plan) => `Upgrade plan for ${plan.module.id}: ${plan.action}
Current: ${plan.module.currentVersion}
Target: ${plan.module.targetVersion}
Approval required: ${plan.approvalRequired}
Risk: ${plan.risk}
Files: ${plan.filesLikelyTouched.join(", ") || "none"}
`
        );
  }

  if (resource === "compose") {
    response = composeApp(templateInput(action, flags));
    return flags.json ? writeJson(response) : printHuman(response, formatComposition);
  }

  if (resource === "graph") {
    const { ids, result } = await buildHoneycomb({ templateId: action, modules: flags.modules });

    if (!result.ok) {
      if (flags.json) {
        return writeJson({ ok: false, modules: ids, issues: result.issues, warnings: result.warnings });
      }
      process.stderr.write(`Connection issues for [${ids.join(", ")}]:\n`);
      process.stderr.write(formatIssues(result.issues));
      process.exitCode = 1;
      return;
    }

    if (flags.json) {
      return writeJson(result.wiring);
    }
    process.stdout.write(formatHoneycomb(result.wiring, result.warnings));
    return;
  }

  if (resource === "validate") {
    response = validateConfig(templateInput(action, flags));
    return flags.json ? writeJson(response) : printHuman(response, (result) => `Valid: ${result.valid}\nBindings: ${result.requiredBindings.join(", ")}\nStorage: ${result.requiredStorage.join(", ")}\nWarnings: ${result.warnings.length ? result.warnings.join("; ") : "none"}\n`);
  }

  if (resource === "check") {
    const input = templateInput(action, flags);
    response = runChecks(input);
    const checkData = response?.data ?? response;
    await track(
      checkData?.status === "pass" ? "check_passed" : "check_failed",
      cliTelemetryProps(flags, {
        status: checkData?.status ?? "unknown",
        template: input.templateId,
        moduleCount: input.modules?.length ?? 0,
      })
    );
    return flags.json ? writeJson(response) : printHuman(response, (result) => `${result.status}\n${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}\n`);
  }

  if (resource === "generate") {
    response = generateProject(templateInput(action, flags));
    const generated = assertOk(response);
    const written = await writeGeneratedFiles(flags.out, generated.files);
    const output = {
      ...response,
      data: {
        composition: generated.composition,
        written,
        nextSteps: generated.nextSteps,
      },
    };
    return flags.json
      ? writeJson(output)
      : process.stdout.write(`Generated ${written.length} files in ${resolve(USER_CWD, flags.out)}\n${generated.nextSteps.map((step) => `- ${step}`).join("\n")}\n`);
  }

  if (resource === "deploy" && action === "plan-resources") {
    response = planDeploymentResources({ ...templateInput(value, flags), mode: flags.mode });
    return flags.json
      ? writeJson(response)
      : printHuman(response, (result) => {
          const d1 = result.resources.d1.map((item) => item.binding + " (" + item.databaseName + ")").join(", ");
          const kv = result.resources.kv.map((item) => item.binding).join(", ");
          return `Mode: ${result.mode}\nWorkers: ${result.workers.length}\nD1: ${d1 || "none"}\nKV: ${kv || "none"}\n`;
        });
  }

  if (resource === "deploy" && action === "preview") {
    const body = {
      ...templateInput(value, flags),
      projectId: flags.projectId ?? undefined,
      name: flags.name ?? undefined,
      actor: flags.actor ?? "agent",
      environment: "preview",
    };
    response = await apiRequest(flags, "/deployments/preview", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => formatPreparedDeployment(result, "Preview deployment")
        );
  }

  if (resource === "deploy" && action === "dev") {
    const startedAt = Date.now();
    const body = {
      ...templateInput(value, flags),
      projectId: flags.projectId ?? undefined,
      name: flags.name ?? undefined,
      actor: flags.actor ?? "agent",
      environment: "dev",
    };
    await track(
      "workspace_start_attempted",
      cliTelemetryProps(flags, {
        kind: "managed_dev",
        template: body.templateId,
        moduleCount: body.modules?.length ?? 0,
      })
    );
    response = await apiRequest(flags, "/deployments/dev", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await trackResponse(
      "workspace_start_completed",
      "workspace_start_failed",
      response,
      cliTelemetryProps(flags, {
        kind: "managed_dev",
        template: body.templateId,
        moduleCount: body.modules?.length ?? 0,
        durationMs: Date.now() - startedAt,
      })
    );
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => formatPreparedDeployment(result, "Dev deployment")
        );
  }

  if (resource === "deploy" && action === "production") {
    if (flags.plan) {
      response = productionDeployPlan(value, flags);
      return flags.json
        ? writeJson(response)
        : printHuman(
            response,
            (plan) => `Production deploy plan
Approval required: ${plan.approvalRequired}
Confirmation: ${plan.confirmationRequired}
Checks:
${plan.checksRequired.map((item) => `- ${item}`).join("\n")}
Side effects:
${plan.sideEffects.map((item) => `- ${item}`).join("\n")}
`
          );
    }

    if (flags.confirm !== "production") {
      response = failResponse(
        "PRODUCTION_CONFIRMATION_REQUIRED",
        "Production deployment preparation requires explicit confirmation.",
        "Run microservices deploy production --plan --json first, then pass --confirm production after approval.",
        { environment: "production", confirmationRequired: "production" }
      );
      return flags.json ? writeJson(response) : printHuman(response, () => "");
    }

    const body = {
      ...templateInput(value, flags),
      projectId: flags.projectId ?? undefined,
      name: flags.name ?? undefined,
      actor: flags.actor ?? "agent",
      confirm: flags.confirm,
    };
    response = await apiRequest(flags, "/deployments/production", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => formatPreparedDeployment(result, "Production deployment")
        );
  }

  if (resource === "deploy" && action === "status") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${value}`);
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Preview URL: ${result.deployment.previewUrl ?? "not provisioned yet"}
Artifact: ${result.artifact?.checksum ?? "unknown"}
`
        );
  }

  if (resource === "deploy" && action === "artifact") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${value}/artifact`);
    if (!response?.ok) {
      return flags.json ? writeJson(response) : printApiHuman(response, () => "");
    }

    const written = await writeGeneratedFiles(flags.out, response.data.files ?? []);
    const manifestPath = response.data.manifest
      ? await writeDeploymentManifest(flags.out, response.data.manifest)
      : null;
    const output = {
      ...response,
      data: {
        ...response.data,
        written,
        manifestPath,
      },
    };

    const commands = response.data.manifest?.commands
      ? Object.entries(response.data.manifest.commands)
          .filter((entry) => typeof entry[1] === "string" && entry[1])
          .map(([name, command]) => `- ${name}: ${command}`)
          .join("\n")
      : "";

    return flags.json
      ? writeJson(output)
      : process.stdout.write(`Wrote deployment artifact ${response.data.artifact.id} to ${resolve(USER_CWD, flags.out)}\n${written.map((path) => `- ${path}`).join("\n")}\n${manifestPath ? `Manifest: ${manifestPath}\n` : ""}${commands ? `Commands:\n${commands}\n` : ""}`);
  }

  if (resource === "deploy" && action === "pipeline") {
    response = await deploymentPipelinePlan(value, flags.dir, flags);
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Deployment pipeline: ${result.environment}
Deployment: ${result.deploymentId}
Artifact: ${result.artifactDirectory}
Steps:
${result.steps.map((step) => `- ${step.id}: ${step.command}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "verify") {
    response = await verifyDeploymentArtifact(flags.dir ?? value);
    if (response.ok && response.data?.status === "fail") {
      process.exitCode = 1;
    }
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Deployment artifact verification: ${result.status}
Directory: ${result.directory}
Manifest: ${result.manifestPath}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "bind") {
    const explicitResources = parseResourceAssignments(flags);
    let resources = explicitResources;
    let source = "explicit-flags";

    if (!resources.length) {
      if (!value) {
        response = failResponse(
          "DEPLOYMENT_OR_BINDINGS_REQUIRED",
          "Missing deployment id or explicit binding ids.",
          "Pass deploy bind <deployment-id> --dir <artifact-dir>, or pass --d1/--kv binding assignments.",
          {}
        );
        return flags.json ? writeJson(response) : printHuman(response, () => "");
      }

      const resourcesResponse = await apiRequest(flags, `/deployments/${value}/resources`);
      if (!resourcesResponse?.ok) {
        return flags.json ? writeJson(resourcesResponse) : printApiHuman(resourcesResponse, () => "");
      }
      resources = resourcesResponse.data.resources ?? [];
      source = `deployment:${value}`;
    }

    response = await bindDeploymentArtifact(flags.dir, resources, source);
    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Deployment artifact bindings: ${result.status}
Directory: ${result.directory}
Wrangler: ${result.wranglerPath}
Applied:
${result.applied.length ? result.applied.map((item) => `- ${item.resourceType}/${item.binding}: ${item.externalId}`).join("\n") : "none"}
Skipped:
${result.skipped.length ? result.skipped.map((item) => `- ${item.resourceType}/${item.binding}: ${item.reason}`).join("\n") : "none"}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "migrate") {
    if (!flags.dir && value) {
      response = await apiRequest(flags, `/deployments/${value}/migrate`, {
        method: "POST",
        body: JSON.stringify({ confirm: flags.confirm ?? undefined }),
      });
      return flags.json ? writeJson(response) : printApiHuman(response, formatRemoteMigration);
    }

    response = await migrateDeploymentArtifact(flags.dir ?? value, flags);
    if (!response.ok) {
      process.exitCode = 1;
      if (flags.json) return writeJson(response);
      printHuman(response, () => "");
      const failedResult = response.data?.results?.find((result) => result.exitCode !== 0);
      if (failedResult?.stderr) process.stderr.write(`\n${failedResult.stderr}\n`);
      if (failedResult?.stdout) process.stdout.write(`\n${failedResult.stdout}\n`);
      return;
    }

    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Deployment migration: ${result.status}
${result.commands ? `Commands:\n${result.commands.map((item) => `- ${[item.command, ...item.args].join(" ")}`).join("\n")}\n` : ""}Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "upload") {
    if (!flags.dir && value) {
      if (flags.plan || flags.dryRun) {
        response = await apiRequest(flags, `/deployments/${value}/upload-plan`);
        return flags.json
          ? writeJson(response)
          : printApiHuman(
              response,
              (result) => `Deployment upload plan: ${result.status}
Deployment: ${result.deployment.id}
Worker: ${result.workerName}
Adapter ready: ${result.adapter.ready}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
`
            );
      }

      response = await apiRequest(flags, `/deployments/${value}/upload`, {
        method: "POST",
        body: JSON.stringify({ confirm: flags.confirm ?? undefined }),
      });
      return flags.json
        ? writeJson(response)
        : printApiHuman(
            response,
            (result) => `Deployment upload: ${result.deployment?.status ?? "submitted"}\n`
          );
    }

    response = await uploadDeploymentArtifact(flags.dir ?? value, flags);
    if (!response.ok) {
      process.exitCode = 1;
      if (flags.json) return writeJson(response);
      printHuman(response, () => "");
      if (response.data?.stderr) process.stderr.write(`\n${response.data.stderr}\n`);
      if (response.data?.stdout) process.stdout.write(`\n${response.data.stdout}\n`);
      return;
    }

    return flags.json
      ? writeJson(response)
      : printHuman(
          response,
          (result) => `Deployment upload: ${result.status}
Directory: ${result.upload.cwd}
Command: ${[result.upload.command, ...result.upload.args].join(" ")}
Dry run: ${result.upload.dryRun}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "upload-plan") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${value}/upload-plan`);
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `Deployment upload plan: ${result.status}
Deployment: ${result.deployment.id}
Worker: ${result.workerName}
Adapter ready: ${result.adapter.ready}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
Local fallback:
${result.localFallback.commands.map((command) => `- ${command}`).join("\n")}
`
        );
  }

  if (resource === "deploy" && action === "cleanup") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }

    if (flags.plan) {
      response = {
        ok: true,
        requestId: `local_${Date.now().toString(36)}`,
        data: {
          status: "planned",
          deploymentId: value,
          endpoint: `/deployments/${value}/cleanup`,
          confirmationRequired: "cleanup",
          productionConfirmationRequired: "production-cleanup",
          sideEffects: [
            "delete managed Worker, KV, and D1 resources through the control-plane API",
            "mark deployment resources deleted",
            "disable deployment routes and status",
          ],
          nextSteps: [`Run microservices deploy cleanup ${value} --confirm cleanup.`],
        },
        warnings: [],
      };
      return flags.json
        ? writeJson(response)
        : printHuman(response, (result) => `Cleanup plan: ${result.status}\nNext: ${result.nextSteps.join(" ")}\n`);
    }

    response = await apiRequest(flags, `/deployments/${value}/cleanup`, {
      method: "POST",
      body: JSON.stringify({ confirm: flags.confirm ?? undefined }),
    });
    return flags.json ? writeJson(response) : printApiHuman(response, formatRemoteCleanup);
  }

  if (resource === "deploy" && (action === "domain" || action === "custom-domain")) {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    if (!flags.hostname) {
      throw new Error("Missing --hostname <hostname>.");
    }

    response = await apiRequest(flags, `/deployments/${value}/routes/custom-domain`, {
      method: "POST",
      body: JSON.stringify({
        hostname: flags.hostname,
        validationMethod: flags.validationMethod ?? undefined,
        cfCustomHostnameId: flags.cfCustomHostnameId ?? undefined,
        cfHostnameStatus: flags.cfHostnameStatus ?? undefined,
        cfSslStatus: flags.cfSslStatus ?? undefined,
      }),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(response, formatDomainRoute);
  }

  if (resource === "deploy" && (action === "domain-refresh" || action === "custom-domain-refresh")) {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    if (!flags.hostname) {
      throw new Error("Missing --hostname <hostname>.");
    }

    response = await apiRequest(flags, `/deployments/${value}/routes/custom-domain/refresh`, {
      method: "POST",
      body: JSON.stringify({
        hostname: flags.hostname,
        cfCustomHostnameId: flags.cfCustomHostnameId ?? undefined,
      }),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(response, formatDomainRoute);
  }

  if (resource === "deploy" && action === "activate") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }

    response = await apiRequest(flags, `/deployments/${value}/activate`, {
      method: "POST",
      body: JSON.stringify({
        url: flags.url ?? undefined,
        mode: flags.mode ?? "wrangler-local",
        confirm: flags.confirm ?? undefined,
      }),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
URL: ${result.deployment.previewUrl ?? "not set"}
Next: ${result.nextSteps.join(" ")}
`
        );
  }

  if (resource === "deploy" && action === "provision") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${value}/provision`, {
      method: "POST",
      body: JSON.stringify({ confirm: flags.confirm ?? undefined }),
    });
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Resources:
${result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n")}
Next: ${result.nextSteps.join(" ")}
`
        );
  }

  if (resource === "deploy" && action === "resources") {
    if (!value) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${value}/resources`);
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `Deployment: ${result.deployment.id}
Resources:
${result.resources.length ? result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n") : "none"}
`
        );
  }

  if ((resource === "deploy" && action === "logs") || resource === "logs") {
    const deploymentId = resource === "logs" ? action : value;
    if (!deploymentId) {
      throw new Error("Missing deployment id.");
    }
    response = await apiRequest(flags, `/deployments/${deploymentId}/logs`);
    return flags.json
      ? writeJson(response)
      : printApiHuman(
          response,
          (result) => `${result.logs.map((log) => `${log.level.toUpperCase()} ${log.message}`).join("\n")}\n`
        );
  }

  if (resource === "metrics") {
    if (!flags.token) {
      throw new Error("Missing --token or METRICS_TOKEN env for metrics request.");
    }
    response = await apiRequest(flags, "/metrics", {
      headers: { Authorization: `Bearer ${flags.token}` },
    });
    if (flags.json) {
      return writeJson(response);
    }
    if (!response?.ok) {
      process.stderr.write(`Error: ${response?.error ?? "metrics request failed"}\n`);
      process.exitCode = 1;
      return;
    }
    const intents = Object.entries(response.waitlist.byIntent).map(([k, n]) => `  ${k}: ${n}`).join("\n") || "  (none)";
    const evs = Object.entries(response.events.byName).map(([k, n]) => `  ${k}: ${n}`).join("\n") || "  (none)";
    process.stdout.write(`Waitlist (${response.waitlist.total} total)\n${intents}\n\nEvents (${response.events.total} total)\n${evs}\n`);
    return;
  }

  process.stderr.write(usage());
  process.exitCode = 1;
}

main().catch((error) => {
  if (error.response) {
    writeJson(error.response);
  } else {
    process.stderr.write(`Error: ${error.message}\n`);
  }
  process.exitCode = 1;
});
