#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join, relative, resolve } from "node:path";

const SOURCE_REPO = "microservices-sh/microservices-sh";
const DEFAULT_API_URL = "https://api.microservices.sh";
const DEFAULT_CONFIG_PATH = process.env.MICROSERVICES_CONFIG_PATH
  ? resolve(process.env.MICROSERVICES_CONFIG_PATH)
  : join(process.env.MICROSERVICES_CONFIG_DIR || join(homedir(), ".microservices"), "config.json");
const IGNORE = new Set(["node_modules", "dist", ".svelte-kit", ".wrangler", ".git"]);

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonc(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  const stripped = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(stripped);
}

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(code, message, remediation, details = {}) {
  return {
    ok: false,
    error: { code, message, remediation, details }
  };
}

function emit(response, formatter = null, flags = { json: false }) {
  if (flags.json) {
    output(response);
  } else if (!response.ok) {
    process.stderr.write(`Error: ${response.error.message}\n`);
    process.stderr.write(`Next: ${response.error.remediation}\n`);
  } else if (formatter) {
    process.stdout.write(formatter(response.data));
  } else {
    output(response);
  }

  if (!flags.json && response.warnings?.length) {
    process.stdout.write(`Warnings:\n${response.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
  }

  process.exitCode = response.ok ? 0 : 1;
}

const manifest = readJson("microservices.template.json", {});
const lock = readJson("microservices.lock.json", { modules: [] });

function parseArgs(argv) {
  const args = [];
  const flags = {
    json: false,
    dryRun: false,
    plan: false,
    confirm: null,
    url: null,
    apiUrl: process.env.MICROSERVICES_API_URL ?? null,
    apiKey: process.env.MICROSERVICES_API_KEY ?? process.env.MICROSERVICES_TOKEN ?? null,
    actor: process.env.USER ?? "agent",
    name: null,
    projectId: null,
    mode: null,
    host: "127.0.0.1",
    port: "5174"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    } else if (value === "--json") {
      flags.json = true;
    } else if (value === "--dry-run") {
      flags.dryRun = true;
      flags.plan = true;
    } else if (value === "--plan") {
      flags.plan = true;
    } else if (value === "--confirm") {
      flags.confirm = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--url") {
      flags.url = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--api-url") {
      flags.apiUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--api-key") {
      flags.apiKey = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--actor") {
      flags.actor = argv[index + 1] ?? flags.actor;
      index += 1;
    } else if (value === "--name") {
      flags.name = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--project-id") {
      flags.projectId = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--mode") {
      flags.mode = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--host") {
      flags.host = argv[index + 1] ?? flags.host;
      index += 1;
    } else if (value === "--port") {
      flags.port = argv[index + 1] ?? flags.port;
      index += 1;
    } else {
      args.push(value);
    }
  }

  return { args, flags };
}

function commandEnv() {
  const localBin = resolve("node_modules", ".bin");
  return {
    ...process.env,
    PATH: [localBin, process.env.PATH].filter(Boolean).join(delimiter)
  };
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function runCommand(id, command, args, flags) {
  const capture = flags.json;
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: commandEnv(),
    shell: process.platform === "win32",
    stdio: capture ? "pipe" : "inherit"
  });

  if (result.error && typeof result.status !== "number") {
    return fail("COMMAND_FAILED", `${id} failed to start.`, result.error.message, {
      command: commandText(command, args)
    });
  }

  const exitCode = result.status ?? 1;
  return {
    ok: exitCode === 0,
    data: {
      id,
      command: commandText(command, args),
      exitCode,
      stdout: capture ? (result.stdout ?? "") : undefined,
      stderr: capture ? (result.stderr ?? "") : undefined
    },
    ...(exitCode === 0
      ? {}
      : {
          error: {
            code: "COMMAND_FAILED",
            message: `${id} failed.`,
            remediation: "Review the command output, confirm dependencies are installed, and rerun the command.",
            details: { command: commandText(command, args), exitCode }
          }
        })
  };
}

function runSteps(steps, flags, nextSteps = []) {
  const results = [];
  for (const step of steps) {
    const result = runCommand(step.id, step.command, step.args, flags);
    results.push(result.data);
    if (!result.ok) {
      return {
        ...result,
        data: {
          status: "failed",
          failedStep: step.id,
          results
        }
      };
    }
  }

  return {
    ok: true,
    data: {
      status: "passed",
      results,
      nextSteps
    }
  };
}

function integrityOf(root) {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (IGNORE.has(name)) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else files.push(abs);
    }
  })(root);

  const manifestText = files
    .map((file) => `${relative(root, file)}:${createHash("sha256").update(readFileSync(file)).digest("hex")}`)
    .sort()
    .join("\n");
  return `sha256-${createHash("sha256").update(manifestText).digest("hex")}`;
}

async function addModule(id) {
  if (!id) {
    return fail("MODULE_ID_REQUIRED", "Missing module id.", "Run microservices add <module-id>.");
  }

  const tmp = mkdtempSync(join(tmpdir(), "ms-add-"));
  try {
    execFileSync("git", ["clone", "-q", "--no-tags", "--depth", "1", `https://github.com/${SOURCE_REPO}.git`, tmp], { stdio: "pipe" });

    const src = join(tmp, "modules", id);
    if (!existsSync(src)) {
      return fail("MODULE_NOT_FOUND", `Unknown module: ${id}.`, "Run microservices modules list, or browse modules/ in microservices-sh/microservices-sh.", { id });
    }

    const ref = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const integrity = integrityOf(src);
    const modulePkg = readJson(join(src, "package.json"), {});

    const dest = resolve("modules", id);
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, {
      recursive: true,
      filter: (source) => !source.split(/[\\/]/).some((part) => IGNORE.has(part))
    });

    const lockPath = "microservices.lock.json";
    const lockData = readJson(lockPath, { modules: [] });
    lockData.modules = (lockData.modules ?? []).filter((module) => module.id !== id);
    lockData.modules.push({
      id,
      version: modulePkg.version ?? null,
      repo: SOURCE_REPO,
      ref,
      path: `modules/${id}`,
      integrity
    });
    writeJsonFile(lockPath, lockData);

    return {
      ok: true,
      data: {
        id,
        vendoredTo: `modules/${id}`,
        integrity,
        version: modulePkg.version ?? null,
        source: SOURCE_REPO
      },
      warnings: [`Add "@microservices-sh/${id}": "file:./modules/${id}" to dependencies and reinstall to wire it in.`]
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function checkResponse() {
  const checks = [
    { id: "manifest", status: existsSync("microservices.template.json") ? "pass" : "fail" },
    { id: "lockfile", status: existsSync("microservices.lock.json") ? "pass" : "fail" },
    { id: "api-boundary", status: existsSync("docs/api-boundary.md") ? "pass" : "fail" },
    { id: "wrangler-config", status: existsSync("wrangler.jsonc") ? "pass" : "fail" },
    { id: "migrations", status: existsSync("migrations/0001_core.sql") ? "pass" : "fail" },
    { id: "http-smoke", status: existsSync("scripts/smoke-http.mjs") ? "pass" : "fail" }
  ];
  const failed = checks.filter((check) => check.status === "fail");
  return {
    ok: failed.length === 0,
    data: {
      template: manifest.id,
      checks
    },
    ...(failed.length
      ? {
          error: {
            code: "CHECK_FAILED",
            message: "One or more generated app checks failed.",
            remediation: "Restore the missing template files before running local or deploy commands.",
            details: { failed }
          }
        }
      : {})
  };
}

function localSetup(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  return runSteps(
    [
      { id: "local:build", command: "vite", args: ["build"] },
      { id: "local:migrate", command: "wrangler", args: ["d1", "migrations", "apply", "DB", "--local"] }
    ],
    flags,
    ["Run microservices local dev, then microservices local smoke in another terminal."]
  );
}

function localDev(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  const migrated = runCommand("local:migrate", "wrangler", ["d1", "migrations", "apply", "DB", "--local"], flags);
  if (!migrated.ok) return migrated;

  return runCommand("local:dev", "vite", ["dev", "--host", flags.host, "--port", flags.port, "--strictPort"], flags);
}

function readCliConfig() {
  try {
    const parsed = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function writeCliConfig(config) {
  mkdirSync(dirname(DEFAULT_CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(DEFAULT_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function removeCliConfig() {
  rmSync(DEFAULT_CONFIG_PATH, { force: true });
}

function resolvedApiSettings(flags) {
  const config = readCliConfig();
  return {
    apiUrl: flags.apiUrl ?? config.apiUrl ?? DEFAULT_API_URL,
    apiKey: flags.apiKey ?? config.apiKey ?? null,
    actor: flags.actor ?? config.actor ?? "agent",
    config
  };
}

function apiUrl(baseUrl, path) {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("Missing --api-url or MICROSERVICES_API_URL.");
  return `${base}${path}`;
}

async function apiRequest(flags, path, options = {}) {
  const settings = resolvedApiSettings(flags);
  const target = apiUrl(settings.apiUrl, path);
  const authHeader = settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};

  let response;
  try {
    response = await fetch(target, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    const cause = error.cause?.message ? ` (${error.cause.message})` : "";
    return fail(
      "API_UNREACHABLE",
      `Failed to reach microservices API at ${settings.apiUrl}.`,
      "Check MICROSERVICES_API_URL, network access, and the API service status, then retry.",
      { path, cause: `${error.message}${cause}` }
    );
  }

  const payload = await response.json().catch(() => ({
    ok: false,
    error: {
      code: "API_RESPONSE_INVALID",
      message: `Non-JSON response from API with status ${response.status}.`,
      remediation: "Check the API URL and retry."
    }
  }));

  if (!response.ok && payload && typeof payload === "object") {
    payload.httpStatus = response.status;
  }

  return payload;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function redactToken(value) {
  if (!value) return null;
  if (value.length <= 10) return "configured";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function authLogin(flags) {
  const settings = resolvedApiSettings(flags);

  if (settings.apiKey) {
    const warnings = [];
    const status = await apiRequest(flags, "/auth/status");
    if (!status.ok && status.error?.code !== "API_UNREACHABLE") {
      return status;
    }
    if (!status.ok) {
      warnings.push(`Saved credentials without server validation: ${status.error.message}`);
    }

    writeCliConfig({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
      actor: settings.actor,
      updatedAt: new Date().toISOString()
    });

    return {
      ok: true,
      data: {
        apiUrl: settings.apiUrl,
        actor: settings.actor,
        configPath: DEFAULT_CONFIG_PATH,
        token: redactToken(settings.apiKey),
        server: status.ok ? status.data : null
      },
      warnings
    };
  }

  const start = await apiRequest(flags, "/auth/device/start", { method: "POST", body: "{}" });
  if (!start.ok) return start;

  const { userCode, deviceCode, verificationUri, interval, expiresIn } = start.data;
  process.stderr.write(
    `\nOpen this URL and enter the code:\n\n  ${verificationUri}\n  code: ${userCode}\n\nWaiting for approval (Ctrl-C to cancel)...\n`
  );

  const deadline = Date.now() + (Number(expiresIn) || 900) * 1000;
  let pollMs = (Number(interval) || 5) * 1000;
  let apiKey = null;
  let failure = null;

  while (Date.now() < deadline) {
    await sleep(pollMs);
    const poll = await apiRequest(flags, "/auth/device/poll", {
      method: "POST",
      body: JSON.stringify({ deviceCode })
    });

    if (poll.ok && poll.data?.status === "approved") {
      apiKey = poll.data.apiKey;
      break;
    }
    if (poll.ok && poll.data?.status === "pending") {
      if (poll.data.interval) pollMs = Number(poll.data.interval) * 1000;
      continue;
    }
    if (poll.error?.code === "slow_down") {
      pollMs += 2000;
      continue;
    }
    if (["denied", "expired", "already_claimed", "not_found"].includes(poll.error?.code)) {
      failure = poll.error.code;
      break;
    }
  }

  if (!apiKey) {
    return fail(
      failure ? `DEVICE_${failure.toUpperCase()}` : "DEVICE_TIMEOUT",
      failure ? `Login ${failure.replace(/_/g, " ")}.` : "Login timed out before approval.",
      "Run microservices auth login again."
    );
  }

  writeCliConfig({
    apiUrl: settings.apiUrl,
    apiKey,
    actor: settings.actor,
    updatedAt: new Date().toISOString()
  });

  return {
    ok: true,
    data: {
      apiUrl: settings.apiUrl,
      actor: settings.actor,
      configPath: DEFAULT_CONFIG_PATH,
      token: redactToken(apiKey)
    }
  };
}

async function authStatus(flags) {
  const settings = resolvedApiSettings(flags);
  const server = await apiRequest(flags, "/auth/status");
  return {
    ok: true,
    data: {
      apiUrl: settings.apiUrl,
      configPath: DEFAULT_CONFIG_PATH,
      configured: Boolean(settings.apiKey),
      token: redactToken(settings.apiKey),
      server: server.ok ? server.data : null,
      serverError: server.ok ? null : server.error
    },
    warnings: server.ok ? [] : [`Auth status check failed: ${server.error.message}`]
  };
}

function deploymentInput(flags, environment = "preview") {
  const config = readJson("microservices.config.json", {});
  const wrangler = readJsonc("wrangler.jsonc", {});
  const appSlug =
    config.appSlug ??
    config.appName ??
    wrangler?.vars?.MICROSERVICES_APP_SLUG ??
    wrangler?.name ??
    manifest.id ??
    "booking-sveltekit";
  const moduleIds = Array.isArray(manifest.modules?.required)
    ? manifest.modules.required
    : (lock.modules ?? []).map((module) => module.id).filter(Boolean);

  return {
    templateId: manifest.id ?? config.template ?? "booking-sveltekit",
    modules: moduleIds,
    config: {
      ...config,
      appName: appSlug,
      appSlug,
      template: config.template ?? manifest.id ?? "booking-sveltekit"
    },
    environment,
    projectId: flags.projectId ?? undefined,
    name: flags.name ?? config.business?.name ?? appSlug,
    actor: flags.actor ?? "agent"
  };
}

function deployPreviewPlan(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  const settings = resolvedApiSettings(flags);
  const body = deploymentInput(flags, "preview");
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: settings.apiUrl,
      action: "deploy-preview",
      endpoint: "POST /deployments/preview",
      confirmationRequired: "deploy",
      request: body,
      sideEffects: [
        "create or reuse a control-plane project",
        "prepare a preview deployment record",
        "reserve a managed preview route when the API is configured for it"
      ],
      notDoneLocally: [
        "no local Cloudflare resource creation",
        "no local Wrangler login",
        "no local remote D1 migration",
        "no local Worker upload"
      ],
      nextSteps: [
        "Run microservices auth login, or set MICROSERVICES_API_KEY.",
        "Run microservices deploy preview --confirm deploy.",
        "Run microservices deploy provision <deployment-id> --confirm provision.",
        "Run microservices deploy upload-plan <deployment-id> to see API upload readiness."
      ]
    },
    warnings: [
      "The control-plane API currently reports hosted Worker upload as blocked until the upload adapter is implemented."
    ]
  };
}

async function deployPreview(flags) {
  if (flags.plan || flags.dryRun) return deployPreviewPlan(flags);

  const checks = checkResponse();
  if (!checks.ok) return checks;
  if (flags.confirm !== "deploy") {
    return fail(
      "DEPLOY_CONFIRMATION_REQUIRED",
      "Preview deployment preparation requires explicit confirmation.",
      "Run microservices deploy preview --plan, then rerun with --confirm deploy.",
      { confirmationRequired: "deploy" }
    );
  }

  return apiRequest(flags, "/deployments/preview", {
    method: "POST",
    body: JSON.stringify(deploymentInput(flags, "preview"))
  });
}

function deployProvisionPlan(deploymentId, flags) {
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: resolvedApiSettings(flags).apiUrl,
      deploymentId: deploymentId ?? null,
      endpoint: deploymentId ? `POST /deployments/${deploymentId}/provision` : "POST /deployments/<deployment-id>/provision",
      confirmationRequired: "provision",
      sideEffects: [
        "ask the control-plane API to create or reuse deployment D1/KV resources",
        "store resource ids on the deployment resource records"
      ],
      notDoneLocally: [
        "no local wrangler d1 create",
        "no local wrangler kv namespace create",
        "no local wrangler.jsonc mutation"
      ],
      nextSteps: deploymentId
        ? [`Run microservices deploy provision ${deploymentId} --confirm provision.`]
        : ["Run microservices deploy preview --confirm deploy first, then provision the returned deployment id."]
    }
  };
}

async function deployProvision(deploymentId, flags) {
  if (flags.plan) return deployProvisionPlan(deploymentId, flags);
  if (!deploymentId) {
    return fail(
      "DEPLOYMENT_ID_REQUIRED",
      "Missing deployment id.",
      "Run microservices deploy preview --confirm deploy, then pass the returned deployment id."
    );
  }
  if (!["provision", "production"].includes(flags.confirm ?? "")) {
    return fail(
      "PROVISION_CONFIRMATION_REQUIRED",
      "Managed resource provisioning requires explicit confirmation.",
      `Run microservices deploy provision ${deploymentId} --plan, then rerun with --confirm provision.`,
      { confirmationRequired: "provision" }
    );
  }

  return apiRequest(flags, `/deployments/${deploymentId}/provision`, {
    method: "POST",
    body: JSON.stringify({ confirm: flags.confirm === "production" ? "production" : undefined })
  });
}

async function deployStatus(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}`);
}

async function deployUploadPlan(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/upload-plan`);
}

async function deployResources(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/resources`);
}

async function deployLogs(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/logs`);
}

async function deployActivate(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  if (!flags.url) {
    return fail(
      "DEPLOYMENT_URL_REQUIRED",
      "Activation requires a deployment URL from the managed upload step.",
      "Run microservices deploy upload-plan <deployment-id> and wait for the API upload adapter to be ready."
    );
  }
  return apiRequest(flags, `/deployments/${deploymentId}/activate`, {
    method: "POST",
    body: JSON.stringify({
      url: flags.url,
      mode: flags.mode ?? "dispatch-uploaded",
      confirm: flags.confirm ?? undefined
    })
  });
}

async function deployDisable(deploymentId, flags) {
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id to disable.");
  }
  if (flags.confirm !== "disable") {
    return fail(
      "DISABLE_CONFIRMATION_REQUIRED",
      "Disabling a deployment requires explicit confirmation.",
      `Run microservices deploy disable ${deploymentId} --confirm disable.`,
      { confirmationRequired: "disable" }
    );
  }
  return apiRequest(flags, `/deployments/${deploymentId}/disable`, { method: "POST", body: "{}" });
}

async function deployDoctor(flags, deploymentId = null) {
  const local = checkResponse();
  const settings = resolvedApiSettings(flags);
  const checks = [
    ...local.data.checks.map((check) => ({
      id: `local:${check.id}`,
      status: check.status,
      message: check.status === "pass" ? `${check.id} exists.` : `${check.id} is missing.`
    })),
    {
      id: "api-key",
      status: settings.apiKey ? "pass" : "warn",
      message: settings.apiKey
        ? `API key is configured at ${DEFAULT_CONFIG_PATH}.`
        : "No API key configured; API commands require auth unless the API has auth disabled."
    }
  ];

  const auth = await apiRequest(flags, "/auth/status");
  checks.push({
    id: "api-auth",
    status: auth.ok ? "pass" : "fail",
    message: auth.ok ? `API reachable; auth mode is ${auth.data?.mode ?? "unknown"}.` : auth.error.message
  });

  if (deploymentId) {
    const status = await deployStatus(deploymentId, flags);
    checks.push({
      id: "deployment",
      status: status.ok ? "pass" : "fail",
      message: status.ok ? `Deployment ${deploymentId} is ${status.data.deployment.status}.` : status.error.message
    });
  }

  const failed = checks.filter((check) => check.status === "fail");
  const warned = checks.filter((check) => check.status === "warn");
  const status = failed.length ? "fail" : warned.length ? "warn" : "pass";

  return {
    ok: failed.length === 0,
    data: {
      status,
      apiUrl: settings.apiUrl,
      configPath: DEFAULT_CONFIG_PATH,
      deploymentId,
      checks,
      nextSteps:
        status === "pass"
          ? ["Run microservices deploy preview --plan."]
          : [
              settings.apiKey ? null : "Run microservices auth login, or set MICROSERVICES_API_KEY.",
              "Confirm MICROSERVICES_API_URL points at the managed API.",
              "Restore any missing local template files."
            ].filter(Boolean)
    },
    ...(failed.length
      ? {
          error: {
            code: "DEPLOY_DOCTOR_FAILED",
            message: "One or more deploy checks failed.",
            remediation: "Review data.checks, fix the failed checks, then rerun deploy doctor.",
            details: { failed }
          }
        }
      : {})
  };
}

function previewSmoke(flags, value) {
  const url = flags.url || value || process.env.MICROSERVICES_TEMPLATE_BASE_URL;
  if (!url) {
    return fail(
      "SMOKE_URL_REQUIRED",
      "Preview smoke requires a deployed URL.",
      "Pass --url https://<preview-url> or set MICROSERVICES_TEMPLATE_BASE_URL."
    );
  }
  return runCommand("preview:smoke", "node", ["scripts/smoke-http.mjs", url], flags);
}

function unsupportedLocalRemoteCommand(name) {
  return fail(
    "MANAGED_DEPLOY_ONLY",
    `${name} is no longer a local Cloudflare command in this template.`,
    "Use microservices deploy preview/provision/upload-plan/status so the managed API owns remote resources and deployment state."
  );
}

function formatPreparedDeployment(result) {
  return `Preview deployment: ${result.deployment.id}
Environment: ${result.deployment.environment}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Project: ${result.project.id}
Artifact: ${result.artifact.id}
Preview URL: ${result.deployment.previewUrl ?? "not live yet"}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`;
}

function formatStatus(result) {
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Preview URL: ${result.deployment.previewUrl ?? "not live yet"}
Artifact: ${result.artifact?.checksum ?? "unknown"}
`;
}

function formatProvision(result) {
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Mode: ${result.deployment.mode}
Resources:
${result.resources.length ? result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n") : "none"}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`;
}

function formatUploadPlan(result) {
  return `Deployment upload plan: ${result.status}
Deployment: ${result.deployment.id}
Worker: ${result.workerName}
Adapter ready: ${result.adapter.ready}
Checks:
${result.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}
Next:
${result.nextSteps.map((step) => `- ${step}`).join("\n")}
`;
}

function formatResources(result) {
  return `Deployment: ${result.deployment.id}
Resources:
${result.resources.length ? result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n") : "none"}
`;
}

function formatLogs(result) {
  return `${result.logs.map((log) => `${log.level.toUpperCase()} ${log.message}`).join("\n")}\n`;
}

function usage() {
  return `booking-sveltekit microservices commands:
  microservices modules list [--json]
  microservices add <id> [--json]
  microservices docs <id> [--json]
  microservices upgrade <id> [--plan] [--json]
  microservices check [--json]
  microservices local setup [--json]
  microservices local verify [--json]
  microservices local migrate [--json]
  microservices local dev [--host 127.0.0.1] [--port 5174]
  microservices local smoke [--url http://127.0.0.1:5174] [--json]
  microservices auth login [--api-url https://api.microservices.sh] [--json]
  microservices auth login --api-key <key> [--api-url https://api.microservices.sh] [--json]
  microservices auth status [--json]
  microservices auth logout [--json]
  microservices deploy doctor [deployment-id] [--json]
  microservices deploy preview [--plan] [--confirm deploy] [--name <name>] [--project-id <id>] [--json]
  microservices deploy provision <deployment-id> [--plan] --confirm provision [--json]
  microservices deploy upload-plan <deployment-id> [--json]
  microservices deploy status <deployment-id> [--json]
  microservices deploy resources <deployment-id> [--json]
  microservices deploy logs <deployment-id> [--json]
  microservices deploy activate <deployment-id> --url <managed-url> [--mode dispatch-uploaded] [--json]
  microservices deploy disable <deployment-id> --confirm disable [--json]
  microservices preview deploy [--plan] [--confirm deploy] [--json]       # alias
  microservices preview provision <deployment-id> --confirm provision      # alias
  microservices preview smoke --url <preview-url> [--json]
`;
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const [resource, action, value] = args;

  if (!resource || resource === "help" || resource === "--help" || resource === "-h") {
    process.stdout.write(usage());
    return;
  }

  if (resource === "modules" && action === "list") {
    emit(
      { ok: true, data: lock.modules ?? [] },
      (modules) => `${modules.map((module) => `${module.id}@${module.version}`).join("\n")}\n`,
      flags
    );
  } else if (resource === "add") {
    emit(
      await addModule(action),
      (data) => `Vendored ${data.id} to ${data.vendoredTo}.\n`,
      flags
    );
  } else if (resource === "docs") {
    emit(
      {
        ok: true,
        data: {
          id: action,
          message: "Read docs/llms.txt and root docs/templates/booking-sveltekit.md for template/module guidance."
        }
      },
      (data) => `${data.message}\n`,
      flags
    );
  } else if (resource === "upgrade") {
    const moduleId = action;
    const module = (lock.modules ?? []).find((item) => item.id === moduleId);
    emit(
      {
        ok: Boolean(module),
        data: module
          ? {
              module: {
                id: module.id,
                currentVersion: module.version,
                targetVersion: module.version
              },
              action: "no-op",
              upgradeAvailable: false,
              approvalRequired: false,
              lockfile: {
                template: lock.template,
                contractSnapshotAvailable: Boolean(module.contract)
              }
            }
          : null,
        error: module
          ? undefined
          : {
              code: "MODULE_NOT_INSTALLED",
              message: "Module not installed.",
              remediation: "Run microservices modules list to see installed modules."
            }
      },
      (data) => `${data.module.id} is already at ${data.module.currentVersion}; no upgrade available.\n`,
      flags
    );
  } else if (resource === "check") {
    emit(checkResponse(), (data) => `Template checks: ${data.checks.every((check) => check.status === "pass") ? "pass" : "fail"}\n`, flags);
  } else if (resource === "local" && action === "setup") {
    emit(localSetup(flags), (data) => `Local setup ${data.status}.\n`, flags);
  } else if (resource === "local" && action === "verify") {
    emit(localSetup(flags), (data) => `Local verification ${data.status}.\n`, flags);
  } else if (resource === "local" && action === "migrate") {
    emit(runCommand("local:migrate", "wrangler", ["d1", "migrations", "apply", "DB", "--local"], flags), (data) => `Local migration exited ${data.exitCode}.\n`, flags);
  } else if (resource === "local" && action === "dev") {
    emit(localDev(flags), (data) => `Local dev exited ${data.exitCode}.\n`, flags);
  } else if (resource === "local" && action === "smoke") {
    const url = flags.url || value || "http://127.0.0.1:5174";
    emit(runCommand("local:smoke", "node", ["scripts/smoke-http.mjs", url], flags), (data) => `Local smoke exited ${data.exitCode}.\n`, flags);
  } else if (resource === "auth" && action === "login") {
    emit(await authLogin(flags), (data) => `Logged in for ${data.apiUrl}.\nConfig: ${data.configPath}\n`, flags);
  } else if (resource === "auth" && action === "status") {
    emit(await authStatus(flags), (data) => `API: ${data.apiUrl}\nToken: ${data.configured ? data.token : "not configured"}\nServer auth: ${data.server ? "authenticated" : "unknown"}\nConfig: ${data.configPath}\n`, flags);
  } else if (resource === "auth" && action === "logout") {
    removeCliConfig();
    emit({ ok: true, data: { configPath: DEFAULT_CONFIG_PATH } }, (data) => `Logged out. Removed ${data.configPath}\n`, flags);
  } else if (resource === "deploy" && action === "doctor") {
    emit(await deployDoctor(flags, value ?? null), (data) => `Deploy doctor: ${data.status}\n`, flags);
  } else if (resource === "deploy" && action === "preview") {
    emit(await deployPreview(flags), formatPreparedDeployment, flags);
  } else if (resource === "deploy" && action === "provision") {
    emit(await deployProvision(value, flags), (data) => data.resources ? formatProvision(data) : `Provision plan: ${data.status}\n`, flags);
  } else if (resource === "deploy" && action === "upload-plan") {
    emit(await deployUploadPlan(value, flags), formatUploadPlan, flags);
  } else if (resource === "deploy" && action === "status") {
    emit(await deployStatus(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "resources") {
    emit(await deployResources(value, flags), formatResources, flags);
  } else if ((resource === "deploy" && action === "logs") || resource === "logs") {
    const deploymentId = resource === "logs" ? action : value;
    emit(await deployLogs(deploymentId, flags), formatLogs, flags);
  } else if (resource === "deploy" && action === "activate") {
    emit(await deployActivate(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "disable") {
    emit(await deployDisable(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "doctor") {
    emit(await deployDoctor(flags, value ?? null), (data) => `Deploy doctor: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "auth") {
    emit(await authStatus(flags), (data) => `API: ${data.apiUrl}\nToken: ${data.configured ? data.token : "not configured"}\nServer auth: ${data.server ? "authenticated" : "unknown"}\n`, flags);
  } else if (resource === "preview" && action === "deploy") {
    emit(await deployPreview(flags), formatPreparedDeployment, flags);
  } else if (resource === "preview" && action === "provision") {
    emit(await deployProvision(value, flags), (data) => data.resources ? formatProvision(data) : `Provision plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "upload-plan") {
    emit(await deployUploadPlan(value, flags), formatUploadPlan, flags);
  } else if (resource === "preview" && action === "status") {
    emit(await deployStatus(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "resources") {
    emit(await deployResources(value, flags), formatResources, flags);
  } else if (resource === "preview" && action === "logs") {
    emit(await deployLogs(value, flags), formatLogs, flags);
  } else if (resource === "preview" && action === "activate") {
    emit(await deployActivate(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "disable") {
    emit(await deployDisable(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "smoke") {
    emit(previewSmoke(flags, value), (data) => `Preview smoke exited ${data.exitCode}.\n`, flags);
  } else if (resource === "preview" && ["bind", "migrate", "cleanup"].includes(action)) {
    emit(unsupportedLocalRemoteCommand(`preview ${action}`), null, flags);
  } else {
    process.stdout.write(usage());
    process.exitCode = 1;
  }
}

main().catch((error) => {
  emit(fail("CLI_FAILED", error.message, "Review the command arguments and retry."), null, { json: process.argv.includes("--json") });
});
