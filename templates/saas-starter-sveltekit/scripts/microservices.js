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

// Runs the app's static contract spec (microservices.check.mjs) in a child process.
// Keeps `check` fast (no server, no build) while verifying that generated routes stay
// thin adapters over the verified modules instead of local reimplementations.
const CONTRACT_RUNNER = `import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
const specPath = process.argv[2];
const results = [];
let n = 0;
const readSafe = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const record = (ok, message, id) => results.push(ok
  ? { id: id || ("spec:" + (++n)), status: "pass" }
  : { id: id || ("spec:" + (++n)), status: "fail", message });
const exists = (p) => existsSync(p);
const assert = (cond, message, id) => record(Boolean(cond), message, id);
const assertFileIncludes = (p, expected, message) => record(((t) => t !== null && t.includes(expected))(readSafe(p)), message, "spec:" + p);
const assertFileIncludesAll = (p, items, message) => record(((t) => t !== null && items.every((s) => t.includes(s)))(readSafe(p)), message, "spec:" + p);
try {
  const mod = await import(pathToFileURL(specPath).href);
  if (typeof mod.default === "function") {
    await mod.default({ assert, assertFileIncludes, assertFileIncludesAll, exists });
  }
} catch (error) {
  results.push({ id: "spec:contract", status: "fail", message: "contract check threw: " + (error && error.message ? error.message : String(error)) });
}
process.stdout.write(JSON.stringify(results));
`;

function runContractChecks() {
  const specPath = resolve(process.cwd(), "microservices.check.mjs");
  if (!existsSync(specPath)) return [];
  const tmp = mkdtempSync(join(tmpdir(), "msh-spec-"));
  const runnerPath = join(tmp, "run.mjs");
  try {
    writeFileSync(runnerPath, CONTRACT_RUNNER, "utf8");
    const run = spawnSync(process.execPath, [runnerPath, specPath], { encoding: "utf8" });
    if (run.status !== 0 || !run.stdout) {
      const detail = ((run.stderr || "").trim() || "contract check runner failed").slice(0, 240);
      return [{ id: "spec:contract", status: "fail", message: detail }];
    }
    return JSON.parse(run.stdout);
  } catch (error) {
    return [{ id: "spec:contract", status: "fail", message: String((error && error.message) || error).slice(0, 240) }];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

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
  const result = flags.output ? attachOutputFile(response, flags.output) : response;

  if (flags.json) {
    output(result);
  } else if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    process.stderr.write(`Next: ${result.error.remediation}\n`);
  } else if (formatter) {
    process.stdout.write(formatter(result.data));
  } else {
    output(result);
  }

  if (!flags.json && result.warnings?.length) {
    process.stdout.write(`Warnings:\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
  }

  process.exitCode = result.ok ? 0 : 1;
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
    ci: process.env.CI === "true",
    wait: false,
    noBuild: false,
    output: null,
    input: null,
    deploymentId: null,
    timeoutMs: 10 * 60 * 1000,
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
    } else if (value === "--ci") {
      flags.ci = true;
    } else if (value === "--wait") {
      flags.wait = true;
    } else if (value === "--no-build") {
      flags.noBuild = true;
    } else if (value === "--output" || value === "--out") {
      flags.output = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--input" || value === "--from") {
      flags.input = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--deployment-id") {
      flags.deploymentId = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--timeout") {
      flags.timeoutMs = parseDurationMs(argv[index + 1] ?? "") ?? flags.timeoutMs;
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

function parseDurationMs(value) {
  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/^(\d+)(ms|s|m)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (match[2] === "ms") return amount;
  if (match[2] === "s") return amount * 1000;
  if (match[2] === "m") return amount * 60 * 1000;
  return amount;
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
    { id: "http-smoke", status: existsSync("scripts/smoke-http.mjs") ? "pass" : "fail" },
    ...runContractChecks()
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
    "saas-starter-sveltekit";
  const moduleIds = Array.isArray(manifest.modules?.required)
    ? manifest.modules.required
    : (lock.modules ?? []).map((module) => module.id).filter(Boolean);

  return {
    templateId: manifest.id ?? config.template ?? "saas-starter-sveltekit",
    modules: moduleIds,
    config: {
      ...config,
      appName: appSlug,
      appSlug,
      template: config.template ?? manifest.id ?? "saas-starter-sveltekit"
    },
    environment,
    projectId: flags.projectId ?? undefined,
    name: flags.name ?? config.business?.name ?? appSlug,
    actor: flags.actor ?? "agent"
  };
}

function safeArtifactPath(path) {
  const normalized = String(path).replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return null;
  if (parts.some((part) => [".git", ".wrangler", "node_modules"].includes(part))) return null;
  if (parts.some((part) => part === ".env" || part.startsWith(".env."))) return null;
  return parts.join("/");
}

function collectArtifactFile(root, relativePath, files) {
  const safePath = safeArtifactPath(relativePath);
  if (!safePath) return;
  const absolutePath = resolve(root, safePath);
  if (!existsSync(absolutePath) || statSync(absolutePath).isDirectory()) return;
  files.push({
    path: safePath,
    contents: readFileSync(absolutePath, "utf8")
  });
}

function collectArtifactDirectory(root, relativeDirectory, files) {
  const safeDirectory = safeArtifactPath(relativeDirectory);
  if (!safeDirectory) return;
  const absoluteDirectory = resolve(root, safeDirectory);
  if (!existsSync(absoluteDirectory) || !statSync(absoluteDirectory).isDirectory()) return;

  (function walk(directory) {
    for (const name of readdirSync(directory)) {
      const absolutePath = join(directory, name);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        walk(absolutePath);
      } else {
        const path = relative(root, absolutePath).replaceAll("\\", "/");
        collectArtifactFile(root, path, files);
      }
    }
  })(absoluteDirectory);
}

function gitValue(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
  return (result.status ?? 1) === 0 ? result.stdout.trim() || null : null;
}

function ciMetadata() {
  return {
    ci: Boolean(process.env.CI),
    provider: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : process.env.GITLAB_CI === "true" ? "gitlab-ci" : null,
    branch:
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      process.env.CI_COMMIT_REF_NAME ||
      gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    commit:
      process.env.GITHUB_SHA ||
      process.env.CI_COMMIT_SHA ||
      gitValue(["rev-parse", "HEAD"]),
    pullRequest:
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? process.env.GITHUB_REF_NAME ?? null
        : process.env.CI_MERGE_REQUEST_IID ?? null,
    repository:
      process.env.GITHUB_REPOSITORY ||
      process.env.CI_PROJECT_PATH ||
      gitValue(["config", "--get", "remote.origin.url"])
  };
}

function artifactChecksum(files) {
  const manifestText = files
    .map((file) => `${file.path}:${createHash("sha256").update(file.contents).digest("hex")}`)
    .sort()
    .join("\n");
  return `sha256:${createHash("sha256").update(manifestText).digest("hex")}`;
}

function buildDeployArtifact(flags) {
  const input = deploymentInput(flags, "preview");
  const files = [];
  const buildOutput = ".svelte-kit/cloudflare";
  const serverOutput = ".svelte-kit/output/server";
  const cloudflareManifestOutput = ".svelte-kit/cloudflare-tmp";

  if (!existsSync(buildOutput)) {
    return fail(
      "BUILD_OUTPUT_MISSING",
      "Cloudflare build output is missing.",
      "Run pnpm build, or rerun deploy preview without --no-build."
    );
  }

  for (const path of [
    "package.json",
    "wrangler.jsonc",
    "microservices.config.json",
    "microservices.lock.json",
    "microservices.template.json"
  ]) {
    collectArtifactFile(process.cwd(), path, files);
  }
  collectArtifactDirectory(process.cwd(), "migrations", files);
  collectArtifactDirectory(process.cwd(), buildOutput, files);
  collectArtifactDirectory(process.cwd(), serverOutput, files);
  collectArtifactDirectory(process.cwd(), cloudflareManifestOutput, files);

  const required = [
    "package.json",
    "wrangler.jsonc",
    `${buildOutput}/_worker.js`,
    `${serverOutput}/index.js`,
    `${cloudflareManifestOutput}/manifest.js`
  ];
  const missing = required.filter((path) => !files.some((file) => file.path === path));
  if (missing.length) {
    return fail(
      "ARTIFACT_INCOMPLETE",
      "Deployment artifact is missing required SvelteKit Cloudflare files.",
      "Run pnpm build and ensure the Cloudflare adapter output exists.",
      { missing }
    );
  }

  const checksum = artifactChecksum(files);
  const byteCount = files.reduce((total, file) => total + Buffer.byteLength(file.contents, "utf8"), 0);
  return {
    ok: true,
    data: {
      ...input,
      artifact: {
        source: "saas-starter-sveltekit-local-build",
        schemaVersion: "2026-06-14",
        composition: {
          compositionId: checksum,
          template: {
            id: input.templateId,
            name: "SaaS Starter SvelteKit"
          },
          modules: input.modules.map((id) => ({ id })),
          config: input.config
        },
        files,
        metadata: {
          checksum,
          byteCount,
          fileCount: files.length,
          buildOutput,
          serverOutput,
          cloudflareManifestOutput,
          packageManager: "pnpm",
          createdAt: new Date().toISOString(),
          git: ciMetadata()
        },
        nextSteps: [
          "Provision managed resources through microservices deploy provision --input deployment.json.",
          "Apply managed D1 migrations through microservices deploy migrate --input deployment.json.",
          "Check hosted upload readiness through microservices deploy upload-plan --input deployment.json.",
          "Use microservices deploy cleanup --input deployment.json when a disposable preview is no longer needed."
        ]
      }
    }
  };
}

function writeOutput(path, value) {
  if (!path) return null;
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

function attachOutputFile(response, path) {
  if (!path || !response || typeof response !== "object") return response;
  const target = resolve(path);
  const data =
    response.data && typeof response.data === "object" && !Array.isArray(response.data)
      ? { ...response.data, outputPath: target }
      : { outputPath: target };
  const result = { ...response, data };
  writeOutput(target, result);
  return result;
}

function deploymentIdFromPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const body = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  const deployment = body.deployment && typeof body.deployment === "object" && !Array.isArray(body.deployment) ? body.deployment : null;
  return typeof deployment?.id === "string" && deployment.id.trim() ? deployment.id.trim() : null;
}

function deploymentIdArg(value, flags) {
  if (flags.deploymentId) return { ok: true, data: flags.deploymentId };
  if (value) return { ok: true, data: value };
  if (!flags.input) return { ok: true, data: null };

  let payload;
  try {
    payload = readJson(resolve(flags.input), null);
  } catch (error) {
    return fail(
      "DEPLOYMENT_INPUT_INVALID",
      "Could not read deployment input JSON.",
      "Pass a JSON file written by --output, or pass --deployment-id directly.",
      { input: flags.input, cause: error.message }
    );
  }

  const deploymentId = deploymentIdFromPayload(payload);
  if (!deploymentId) {
    return fail(
      "DEPLOYMENT_ID_NOT_FOUND",
      "Deployment input JSON does not contain data.deployment.id.",
      "Use the JSON file written by deploy preview --output, or pass --deployment-id directly.",
      { input: flags.input }
    );
  }

  return { ok: true, data: deploymentId };
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
        "run the local build unless --no-build is provided",
        "package the Cloudflare build artifact",
        "upload the artifact to the control-plane API",
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
        "Run microservices deploy preview --confirm deploy --output deployment.json.",
        "Run microservices deploy provision --input deployment.json --confirm provision.",
        "Run microservices deploy migrate --input deployment.json --confirm migrate.",
        "Run microservices deploy upload-plan --input deployment.json to see API upload readiness."
      ]
    },
    warnings: [
      "The control-plane API owns resource provisioning, remote migration, Worker/assets upload, preview routing, and cleanup when operator Cloudflare credentials are configured."
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
  const settings = resolvedApiSettings(flags);
  if (flags.ci && !settings.apiKey) {
    return fail(
      "CI_API_KEY_REQUIRED",
      "CI preview deploy requires MICROSERVICES_API_KEY or --api-key.",
      "Create a workspace API key and store it as a CI secret."
    );
  }

  if (!flags.noBuild) {
    const build = runCommand("deploy:build", "vite", ["build"], flags);
    if (!build.ok) return build;
  }

  const body = buildDeployArtifact(flags);
  if (!body.ok) return body;

  const response = await apiRequest(flags, "/deployments/preview", {
    method: "POST",
    body: JSON.stringify(body.data)
  });
  if (!response.ok) return response;

  if (flags.wait) {
    return waitForDeployment(response, flags);
  }

  return response;
}

async function waitForDeployment(response, flags) {
  const deploymentId = response.data?.deployment?.id;
  if (!deploymentId) return response;

  const uploadPlan = await deployUploadPlan(deploymentId, flags);
  if (uploadPlan.ok && uploadPlan.data?.status === "blocked" && uploadPlan.data?.adapter?.ready === false) {
    return {
      ok: false,
      data: {
        ...response.data,
        uploadPlan: uploadPlan.data
      },
      warnings: response.warnings,
      error: {
        code: "HOSTED_UPLOAD_BLOCKED",
        message: "Preview artifact was uploaded, but hosted Worker upload is still blocked.",
        remediation: "Run without --wait to create the prepared deployment, then run provision, migrate, and upload-plan.",
        details: {
          deploymentId,
          blockers: uploadPlan.data.adapter.blockedBy
        }
      }
    };
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < flags.timeoutMs) {
    await sleep(3000);
    const status = await deployStatus(deploymentId, flags);
    if (!status.ok) return status;
    const state = status.data?.deployment?.status;
    if (state === "live") return status;
    if (state === "failed" || state === "disabled") {
      return {
        ok: false,
        data: status.data,
        error: {
          code: "DEPLOYMENT_NOT_LIVE",
          message: `Deployment ended with status ${state}.`,
          remediation: "Run deploy logs for details.",
          details: { deploymentId, status: state }
        }
      };
    }
  }

  return {
    ok: false,
    data: response.data,
    error: {
      code: "DEPLOYMENT_WAIT_TIMEOUT",
      message: "Timed out waiting for preview deployment to become live.",
      remediation: "Run deploy status and deploy logs for the deployment id.",
      details: { deploymentId, timeoutMs: flags.timeoutMs }
    }
  };
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
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

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

function deployMigratePlan(deploymentId, flags) {
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: resolvedApiSettings(flags).apiUrl,
      deploymentId: deploymentId ?? null,
      endpoint: deploymentId ? `POST /deployments/${deploymentId}/migrate` : "POST /deployments/<deployment-id>/migrate",
      confirmationRequired: "migrate",
      productionConfirmationRequired: "production-migrate",
      sideEffects: [
        "ask the control-plane API to apply uploaded SQL migrations to the managed D1 database",
        "record applied migration checksums in the managed D1 database",
        "update deployment logs and lifecycle state"
      ],
      notDoneLocally: [
        "no local wrangler d1 migrations apply --remote",
        "no local Cloudflare API token",
        "no local D1 resource id handling"
      ],
      nextSteps: deploymentId
        ? [`Run microservices deploy migrate ${deploymentId} --confirm migrate.`]
        : ["Run microservices deploy preview --confirm deploy first, provision resources, then migrate the returned deployment id."]
    }
  };
}

async function deployMigrate(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (flags.plan) return deployMigratePlan(deploymentId, flags);
  if (!deploymentId) {
    return fail(
      "DEPLOYMENT_ID_REQUIRED",
      "Missing deployment id.",
      "Run deploy preview and deploy provision first, then pass the deployment id."
    );
  }
  if (!["migrate", "production-migrate"].includes(flags.confirm ?? "")) {
    return fail(
      "MIGRATION_CONFIRMATION_REQUIRED",
      "Remote migration requires explicit confirmation.",
      `Run microservices deploy migrate ${deploymentId} --plan, then rerun with --confirm migrate.`,
      { confirmationRequired: "migrate", productionConfirmationRequired: "production-migrate" }
    );
  }

  return apiRequest(flags, `/deployments/${deploymentId}/migrate`, {
    method: "POST",
    body: JSON.stringify({ confirm: flags.confirm })
  });
}

function deployUploadActionPlan(deploymentId, flags) {
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: resolvedApiSettings(flags).apiUrl,
      deploymentId: deploymentId ?? null,
      endpoint: deploymentId ? `POST /deployments/${deploymentId}/upload` : "POST /deployments/<deployment-id>/upload",
      confirmationRequired: "upload",
      productionConfirmationRequired: "production-upload",
      sideEffects: [
        "ask the control-plane API to validate managed Worker upload prerequisites",
        "ask the API to upload raw SvelteKit assets/modules and attach the managed preview route",
        "update deployment logs and lifecycle state"
      ],
      notDoneLocally: [
        "no local wrangler deploy",
        "no local wrangler login",
        "no local Cloudflare resource id mutation"
      ],
      nextSteps: deploymentId
        ? [
            `Run microservices deploy upload-plan ${deploymentId}.`,
            `Run microservices deploy upload ${deploymentId} --confirm upload when upload-plan is ready.`
          ]
        : ["Run microservices deploy preview --confirm deploy first, then use upload-plan on the returned deployment id."]
    }
  };
}

async function deployUpload(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (flags.plan) return deployUploadActionPlan(deploymentId, flags);
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  if (!["upload", "production-upload"].includes(flags.confirm ?? "")) {
    return fail(
      "UPLOAD_CONFIRMATION_REQUIRED",
      "Hosted Worker upload requires explicit confirmation.",
      `Run microservices deploy upload ${deploymentId} --plan, then rerun with --confirm upload.`,
      { confirmationRequired: "upload", productionConfirmationRequired: "production-upload" }
    );
  }

  return apiRequest(flags, `/deployments/${deploymentId}/upload`, {
    method: "POST",
    body: JSON.stringify({ confirm: flags.confirm })
  });
}

async function deployStatus(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}`);
}

const TERMINAL_DEPLOYMENT_STATES = new Set(["live", "failed", "disabled"]);

async function deployUploadPlan(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/upload-plan`);
}

async function deployResources(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/resources`);
}

async function deployLogs(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  return apiRequest(flags, `/deployments/${deploymentId}/logs`);
}

async function deployFollow(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }

  const startedAt = Date.now();
  let lastLine = "";
  let lastStatus = null;
  let lastLogs = { ok: true, data: { deploymentId, logs: [] } };

  while (Date.now() - startedAt < flags.timeoutMs) {
    const status = await deployStatus(deploymentId, flags);
    if (!status.ok) return status;
    const logs = await deployLogs(deploymentId, flags);
    if (logs.ok) lastLogs = logs;

    const deployment = status.data?.deployment ?? {};
    const state = deployment.status ?? "unknown";
    const previewUrl = deployment.previewUrl ?? "not live yet";
    const latestLog = logs.ok ? logs.data?.logs?.at(-1) : null;
    const latestText = latestLog ? `${latestLog.level.toUpperCase()} ${latestLog.message}` : "No deploy logs yet.";
    const line = `${deploymentId}: ${state} | ${previewUrl} | ${latestText}`;

    if (!flags.json && line !== lastLine) {
      process.stdout.write(`${line}\n`);
      lastLine = line;
    }

    lastStatus = status;
    if (TERMINAL_DEPLOYMENT_STATES.has(String(state))) {
      return {
        ok: state === "live",
        data: {
          ...status.data,
          logs: lastLogs.data?.logs ?? [],
          follow: {
            status: state,
            elapsedMs: Date.now() - startedAt
          }
        },
        ...(state === "live"
          ? {}
          : {
              error: {
                code: "DEPLOYMENT_NOT_LIVE",
                message: `Deployment ended with status ${state}.`,
                remediation: "Run deploy logs for details.",
                details: { deploymentId, status: state }
              }
            })
      };
    }

    await sleep(3000);
  }

  return {
    ok: false,
    data: {
      ...(lastStatus?.data ?? { deployment: { id: deploymentId } }),
      logs: lastLogs.data?.logs ?? [],
      follow: {
        status: lastStatus?.data?.deployment?.status ?? "unknown",
        elapsedMs: Date.now() - startedAt
      }
    },
    error: {
      code: "DEPLOYMENT_FOLLOW_TIMEOUT",
      message: "Timed out waiting for deployment to finish.",
      remediation: "Run deploy status or deploy logs to inspect the current state.",
      details: { deploymentId, timeoutMs: flags.timeoutMs }
    }
  };
}

async function deployActivate(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  if (!flags.url) {
    return fail(
      "DEPLOYMENT_URL_REQUIRED",
      "Activation requires a deployment URL from the managed upload step.",
      "Run microservices deploy upload-plan <deployment-id>, then deploy upload to let the API publish the raw SvelteKit Worker/assets artifact."
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
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

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

function deployCleanupPlan(deploymentId, flags) {
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: resolvedApiSettings(flags).apiUrl,
      deploymentId: deploymentId ?? null,
      endpoint: deploymentId ? `POST /deployments/${deploymentId}/cleanup` : "POST /deployments/<deployment-id>/cleanup",
      confirmationRequired: "cleanup",
      productionConfirmationRequired: "production-cleanup",
      sideEffects: [
        "ask the control-plane API to delete managed Worker, KV, and D1 resources for this deployment",
        "mark deployment resource records deleted",
        "disable deployment routes and deployment status"
      ],
      notDoneLocally: [
        "no local wrangler delete",
        "no local wrangler d1 delete",
        "no local wrangler kv namespace delete"
      ],
      nextSteps: deploymentId
        ? [`Run microservices deploy cleanup ${deploymentId} --confirm cleanup.`]
        : ["Pass the deployment id returned by deploy preview or --input deployment.json."]
    }
  };
}

async function deployCleanup(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (flags.plan) return deployCleanupPlan(deploymentId, flags);
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id to clean up.");
  }
  if (!["cleanup", "production-cleanup"].includes(flags.confirm ?? "")) {
    return fail(
      "CLEANUP_CONFIRMATION_REQUIRED",
      "Resource cleanup requires explicit confirmation.",
      `Run microservices deploy cleanup ${deploymentId} --plan, then rerun with --confirm cleanup.`,
      { confirmationRequired: "cleanup", productionConfirmationRequired: "production-cleanup" }
    );
  }

  return apiRequest(flags, `/deployments/${deploymentId}/cleanup`, {
    method: "POST",
    body: JSON.stringify({ confirm: flags.confirm })
  });
}

async function deployDoctor(flags, deploymentId = null) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

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
    "Use microservices deploy preview/provision/migrate/upload-plan/upload/status/cleanup so the managed API owns remote resources and deployment state."
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

function formatMigration(result) {
  const migration = result.migration ?? { applied: [], appliedCount: 0, skippedCount: 0 };
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Remote migrations: ${migration.appliedCount} applied, ${migration.skippedCount} skipped
${migration.applied.length ? migration.applied.map((item) => `- ${item.name}: ${item.status}`).join("\n") : "none"}
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

function formatUpload(result) {
  const deployment = result.deployment ?? {};
  const upload = result.upload ?? {};
  const previewUrl = deployment.previewUrl ?? upload.previewUrl ?? null;
  return `Deployment upload complete
Deployment: ${deployment.id ?? "unknown"}
Status: ${deployment.status ?? "unknown"}
Mode: ${deployment.mode ?? "unknown"}
Worker: ${upload.workerName ?? deployment.workerName ?? "unknown"}
Preview URL: ${previewUrl ?? "not live yet"}
Next:
${(result.nextSteps ?? []).map((step) => `- ${step}`).join("\n") || "- Run deploy status to refresh the deployment state."}
`;
}

function formatResources(result) {
  return `Deployment: ${result.deployment.id}
Resources:
${result.resources.length ? result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n") : "none"}
`;
}

function formatCleanup(result) {
  return `Deployment: ${result.deployment.id}
Status: ${result.deployment.status}
Cleanup:
${result.cleanup.length ? result.cleanup.map((item) => `- ${item.resource.resourceType}/${item.resource.binding}: ${item.status}`).join("\n") : "none"}
`;
}

function formatLogs(result) {
  return `${result.logs.map((log) => `${log.level.toUpperCase()} ${log.message}`).join("\n")}\n`;
}

function formatFollow(result) {
  const deployment = result.deployment ?? {};
  const logs = result.logs ?? [];
  const latestLogs = logs.slice(-5);
  return `Deployment: ${deployment.id ?? "unknown"}
Status: ${deployment.status ?? "unknown"}
Mode: ${deployment.mode ?? "unknown"}
Preview URL: ${deployment.previewUrl ?? "not live yet"}
Latest logs:
${latestLogs.length ? latestLogs.map((log) => `- ${log.level.toUpperCase()} ${log.message}`).join("\n") : "- No deploy logs yet."}
`;
}

function usage() {
  return `saas-starter-sveltekit microservices commands:
  Global flags: [--json] [--api-url <url>] [--api-key <key>] [--input deployment.json] [--deployment-id <id>] [--output result.json]
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
  microservices deploy preview [--plan] [--confirm deploy] [--name <name>] [--project-id <id>] [--ci] [--wait] [--timeout 10m] [--output deployment.json] [--json]
  microservices deploy provision [deployment-id] [--input deployment.json] [--plan] --confirm provision [--json]
  microservices deploy migrate [deployment-id] [--input deployment.json] [--plan] --confirm migrate [--json]
  microservices deploy upload-plan [deployment-id] [--input deployment.json] [--json]
  microservices deploy upload [deployment-id] [--input deployment.json] [--plan] --confirm upload [--json]
  microservices deploy status [deployment-id] [--input deployment.json] [--json]
  microservices deploy resources [deployment-id] [--input deployment.json] [--json]
  microservices deploy logs [deployment-id] [--input deployment.json] [--json]
  microservices deploy follow [deployment-id] [--input deployment.json] [--timeout 10m] [--json]
  microservices deploy activate [deployment-id] [--input deployment.json] --url <managed-url> [--mode dispatch-uploaded] [--json]
  microservices deploy disable [deployment-id] [--input deployment.json] --confirm disable [--json]
  microservices deploy cleanup [deployment-id] [--input deployment.json] [--plan] --confirm cleanup [--json]
  microservices preview deploy [--plan] [--confirm deploy] [--ci] [--wait] [--json]       # alias
  microservices preview provision <deployment-id> --confirm provision      # alias
  microservices preview migrate <deployment-id> --confirm migrate          # alias
  microservices preview upload <deployment-id> --confirm upload            # alias
  microservices preview cleanup <deployment-id> --confirm cleanup          # alias
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
          message: "Read docs/llms.txt and root docs/templates/saas-starter-sveltekit.md for template/module guidance."
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
  } else if (resource === "deploy" && action === "migrate") {
    emit(await deployMigrate(value, flags), (data) => data.migration ? formatMigration(data) : `Migration plan: ${data.status}\n`, flags);
  } else if (resource === "deploy" && action === "upload-plan") {
    emit(await deployUploadPlan(value, flags), formatUploadPlan, flags);
  } else if (resource === "deploy" && action === "upload") {
    emit(await deployUpload(value, flags), (data) => data.deployment ? formatUpload(data) : `Upload plan: ${data.status}\n`, flags);
  } else if (resource === "deploy" && action === "status") {
    emit(await deployStatus(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "resources") {
    emit(await deployResources(value, flags), formatResources, flags);
  } else if ((resource === "deploy" && action === "logs") || resource === "logs") {
    const deploymentId = resource === "logs" ? action : value;
    emit(await deployLogs(deploymentId, flags), formatLogs, flags);
  } else if (resource === "deploy" && action === "follow") {
    emit(await deployFollow(value, flags), formatFollow, flags);
  } else if (resource === "deploy" && action === "activate") {
    emit(await deployActivate(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "disable") {
    emit(await deployDisable(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "cleanup") {
    emit(await deployCleanup(value, flags), (data) => data.cleanup ? formatCleanup(data) : `Cleanup plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "doctor") {
    emit(await deployDoctor(flags, value ?? null), (data) => `Deploy doctor: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "auth") {
    emit(await authStatus(flags), (data) => `API: ${data.apiUrl}\nToken: ${data.configured ? data.token : "not configured"}\nServer auth: ${data.server ? "authenticated" : "unknown"}\n`, flags);
  } else if (resource === "preview" && action === "deploy") {
    emit(await deployPreview(flags), formatPreparedDeployment, flags);
  } else if (resource === "preview" && action === "provision") {
    emit(await deployProvision(value, flags), (data) => data.resources ? formatProvision(data) : `Provision plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "migrate") {
    emit(await deployMigrate(value, flags), (data) => data.migration ? formatMigration(data) : `Migration plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "upload-plan") {
    emit(await deployUploadPlan(value, flags), formatUploadPlan, flags);
  } else if (resource === "preview" && action === "upload") {
    emit(await deployUpload(value, flags), (data) => data.deployment ? formatUpload(data) : `Upload plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "status") {
    emit(await deployStatus(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "resources") {
    emit(await deployResources(value, flags), formatResources, flags);
  } else if (resource === "preview" && action === "logs") {
    emit(await deployLogs(value, flags), formatLogs, flags);
  } else if (resource === "preview" && action === "follow") {
    emit(await deployFollow(value, flags), formatFollow, flags);
  } else if (resource === "preview" && action === "activate") {
    emit(await deployActivate(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "disable") {
    emit(await deployDisable(value, flags), formatStatus, flags);
  } else if (resource === "preview" && action === "cleanup") {
    emit(await deployCleanup(value, flags), (data) => data.cleanup ? formatCleanup(data) : `Cleanup plan: ${data.status}\n`, flags);
  } else if (resource === "preview" && action === "smoke") {
    emit(previewSmoke(flags, value), (data) => `Preview smoke exited ${data.exitCode}.\n`, flags);
  } else if (resource === "preview" && action === "bind") {
    emit(unsupportedLocalRemoteCommand(`preview ${action}`), null, flags);
  } else {
    process.stdout.write(usage());
    process.exitCode = 1;
  }
}

main().catch((error) => {
  emit(fail("CLI_FAILED", error.message, "Review the command arguments and retry."), null, { json: process.argv.includes("--json") });
});
