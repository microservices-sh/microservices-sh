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
import { createInterface } from "node:readline/promises";

const SOURCE_REPO = process.env.MICROSERVICES_MODULE_SOURCE_REPO || "microservices-sh/microservices-sh";
const SOURCE_URL = process.env.MICROSERVICES_MODULE_SOURCE_URL || `https://github.com/${SOURCE_REPO}.git`;
const DEFAULT_API_URL = "https://api.microservices.sh";
const DEFAULT_CONFIG_PATH = process.env.MICROSERVICES_CONFIG_PATH
  ? resolve(process.env.MICROSERVICES_CONFIG_PATH)
  : join(process.env.MICROSERVICES_CONFIG_DIR || join(homedir(), ".microservices"), "config.json");
const IGNORE = new Set(["node_modules", "dist", ".svelte-kit", ".wrangler", ".git"]);
const FIRST_PARTY_SCOPE = "@microservices-sh/";
const BUNDLED_PACKAGES = new Map([
  ["connection-contract", "connection-contract"]
]);
const TELEMETRY_API_URL = process.env.MICROSERVICES_API_URL || DEFAULT_API_URL;
const TELEMETRY_TIMEOUT_MS = 1500;
const TELEMETRY_NOTICE_MARKER = join(dirname(DEFAULT_CONFIG_PATH), ".telemetry-notice");

function telemetryEnabled() {
  const v = String(process.env.MICROSERVICES_TELEMETRY ?? "").toLowerCase();
  if (["0", "false", "off", "no"].includes(v)) return false;
  const dnt = String(process.env.DO_NOT_TRACK ?? "").toLowerCase();
  if (dnt === "1" || dnt === "true") return false;
  // CI/automation is not human usage — never count it in the activation funnel.
  const ci = String(process.env.CI ?? "").toLowerCase();
  if (ci === "true" || ci === "1") return false;
  return true;
}

function telemetryNotice(json) {
  if (json || !telemetryEnabled()) return;
  try {
    if (existsSync(TELEMETRY_NOTICE_MARKER)) return;
    mkdirSync(dirname(TELEMETRY_NOTICE_MARKER), { recursive: true });
    writeFileSync(TELEMETRY_NOTICE_MARKER, "shown\n", "utf8");
    process.stderr.write(
      "microservices collects anonymous usage to improve the tool - no code, paths, or personal data. Opt out: MICROSERVICES_TELEMETRY=0\n"
    );
  } catch {
    // Never let the notice break the workspace CLI.
  }
}

async function track(name, props = {}) {
  if (!telemetryEnabled()) return;
  try {
    await fetch(`${TELEMETRY_API_URL}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, props, session: "workspace-cli" }),
      signal: AbortSignal.timeout(TELEMETRY_TIMEOUT_MS)
    });
  } catch {
    // Telemetry is best-effort; never surface failures.
  }
}

function durationMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

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
const readText = (p) => {
  const text = readSafe(p);
  if (text === null) throw new Error("File not found: " + p);
  return text;
};
const assert = (cond, message, id) => record(Boolean(cond), message, id);
const assertFileIncludes = (p, expected, message) => record(((t) => t !== null && t.includes(expected))(readSafe(p)), message, "spec:" + p);
const assertFileIncludesAll = (p, items, message) => record(((t) => t !== null && items.every((s) => t.includes(s)))(readSafe(p)), message, "spec:" + p);
try {
  const mod = await import(pathToFileURL(specPath).href);
  if (typeof mod.default === "function") {
    await mod.default({ assert, assertFileIncludes, assertFileIncludesAll, exists, readText });
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
const appProfile = isRecord(manifest.appProfile) ? manifest.appProfile : {};
const localProfile = isRecord(appProfile.local) ? appProfile.local : {};
const deploymentProfile = isRecord(appProfile.deployment) ? appProfile.deployment : {};
const appId = cleanString(manifest.id) ?? cleanString(lock.template) ?? "commerce-ops-sveltekit";
const appDisplayName = cleanString(manifest.displayName) ?? "Commerce Ops SvelteKit";
const wranglerConfigPath = cleanString(appProfile.wranglerConfigPath) ?? "wrangler.jsonc";
const remoteApiApp = appProfile.remoteApi === true || appProfile.kind === "control-plane";
const localRequiresD1 = remoteApiApp ? false : localProfile.requiresD1 !== false;
const localDevHost = cleanString(localProfile.host) ?? "127.0.0.1";
const localDevPort = cleanString(localProfile.port) ?? "5174";
const localD1MigrationArgs = ["d1", "migrations", "apply", "DB", "--local"];
const buildOutput = ".svelte-kit/cloudflare";
const deployBundleOutput = ".microservices/deploy-bundle";
const deployBundleWorker = `${deployBundleOutput}/_worker.js`;

function workspaceTelemetryProps(flags, extra = {}) {
  return {
    source: "workspace-cli",
    template: manifest.id ?? lock.template ?? null,
    moduleCount: (lock.modules ?? []).length,
    json: flags.json,
    ...extra
  };
}

function responseErrorCode(response) {
  return response?.error?.code ?? (response?.ok === false ? "UNKNOWN_ERROR" : null);
}

async function trackResponse(successName, failureName, response, props = {}) {
  if (response?.ok === false) {
    await track(failureName, { ...props, result: "failed", errorCode: responseErrorCode(response) });
    return;
  }
  await track(successName, { ...props, result: "completed" });
}

function parseArgs(argv) {
  const args = [];
  let parseError = null;
  const flags = {
    json: false,
    dryRun: false,
    plan: false,
    apply: false,
    confirm: null,
    url: null,
    hostname: null,
    apiUrl: process.env.MICROSERVICES_API_URL ?? null,
    apiKey: process.env.MICROSERVICES_API_KEY ?? process.env.MICROSERVICES_TOKEN ?? null,
    actor: process.env.USER ?? "agent",
    name: null,
    projectId: null,
    search: null,
    level: null,
    source: null,
    eventType: null,
    since: null,
    before: null,
    limit: null,
    mode: null,
    version: null,
    to: null,
    ci: process.env.CI === "true",
    wait: false,
    noBuild: false,
    target: process.env.MICROSERVICES_DEPLOY_TARGET ?? "managed",
    cloudflareAuth: process.env.MICROSERVICES_CLOUDFLARE_AUTH ?? null,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? null,
    cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID ?? null,
    cloudflarePreviewBaseDomain: process.env.MICROSERVICES_CLOUDFLARE_PREVIEW_DOMAIN ?? null,
    cloudflareConnectionId: process.env.MICROSERVICES_CLOUDFLARE_CONNECTION_ID ?? null,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN ?? null,
    output: null,
    input: null,
    deploymentId: null,
    timeoutMs: 10 * 60 * 1000,
    host: localDevHost,
    port: localDevPort
  };

  function flagValue(index, option, fallback = "") {
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parseError ??= fail(
        "CLI_FLAG_VALUE_REQUIRED",
        `Missing value for ${option}.`,
        `Pass ${option} <value>, or remove ${option}.`
      );
      return { value: fallback, index };
    }
    return { value: next, index: index + 1 };
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    } else if (value === "--json") {
      flags.json = true;
    } else if (value === "--help-all") {
      flags.helpAll = true;
    } else if (value === "--dry-run") {
      flags.dryRun = true;
      flags.plan = true;
    } else if (value === "--plan") {
      flags.plan = true;
    } else if (value === "--apply") {
      // Accepted for parity with the global CLI's `add/remove --apply`.
      // The shim applies by default, so this is an explicit no-op gate.
      flags.apply = true;
    } else if (value === "--confirm") {
      const parsed = flagValue(index, value);
      flags.confirm = parsed.value;
      index = parsed.index;
    } else if (value === "--url") {
      const parsed = flagValue(index, value);
      flags.url = parsed.value;
      index = parsed.index;
    } else if (value === "--hostname" || value === "--host-name" || value === "--domain") {
      const parsed = flagValue(index, value);
      flags.hostname = parsed.value;
      index = parsed.index;
    } else if (value === "--api-url") {
      const parsed = flagValue(index, value);
      flags.apiUrl = parsed.value;
      index = parsed.index;
    } else if (value === "--api-key") {
      const parsed = flagValue(index, value);
      flags.apiKey = parsed.value;
      index = parsed.index;
    } else if (value === "--actor") {
      const parsed = flagValue(index, value, flags.actor);
      flags.actor = parsed.value;
      index = parsed.index;
    } else if (value === "--name") {
      const parsed = flagValue(index, value);
      flags.name = parsed.value;
      index = parsed.index;
    } else if (value === "--project-id") {
      const parsed = flagValue(index, value);
      flags.projectId = parsed.value;
      index = parsed.index;
    } else if (value === "--search" || value === "--q" || value === "--query") {
      const parsed = flagValue(index, value);
      flags.search = parsed.value;
      index = parsed.index;
    } else if (value === "--level") {
      const parsed = flagValue(index, value);
      flags.level = parsed.value;
      index = parsed.index;
    } else if (value === "--source") {
      const parsed = flagValue(index, value);
      flags.source = parsed.value;
      index = parsed.index;
    } else if (value === "--event-type" || value === "--eventType") {
      const parsed = flagValue(index, value);
      flags.eventType = parsed.value;
      index = parsed.index;
    } else if (value === "--since") {
      const parsed = flagValue(index, value);
      flags.since = parsed.value;
      index = parsed.index;
    } else if (value === "--before") {
      const parsed = flagValue(index, value);
      flags.before = parsed.value;
      index = parsed.index;
    } else if (value === "--limit") {
      const parsed = flagValue(index, value);
      flags.limit = parsed.value;
      index = parsed.index;
    } else if (value === "--mode") {
      const parsed = flagValue(index, value);
      flags.mode = parsed.value;
      index = parsed.index;
    } else if (value === "--version") {
      const parsed = flagValue(index, value);
      flags.version = parsed.value;
      index = parsed.index;
    } else if (value === "--to" || value === "--target-version") {
      const parsed = flagValue(index, value);
      flags.to = parsed.value;
      index = parsed.index;
    } else if (value === "--ci") {
      flags.ci = true;
    } else if (value === "--wait") {
      flags.wait = true;
    } else if (value === "--no-build") {
      flags.noBuild = true;
    } else if (value === "--target") {
      const parsed = flagValue(index, value, flags.target);
      flags.target = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-config") {
      // One flag for BYO-Cloudflare instead of seven. Accepts the same fields
      // (auth, accountId, zoneId, previewBaseDomain, connectionId, apiToken).
      // The individual --cloudflare-* flags still work for overrides.
      const parsed = flagValue(index, value);
      index = parsed.index;
      try {
        const cfg = JSON.parse(parsed.value || "{}");
        if (cfg.auth != null) flags.cloudflareAuth = String(cfg.auth);
        if (cfg.accountId != null) flags.cloudflareAccountId = String(cfg.accountId);
        if (cfg.zoneId != null) flags.cloudflareZoneId = String(cfg.zoneId);
        if (cfg.previewBaseDomain != null) flags.cloudflarePreviewBaseDomain = String(cfg.previewBaseDomain);
        if (cfg.connectionId != null) flags.cloudflareConnectionId = String(cfg.connectionId);
        if (cfg.apiToken != null) flags.cloudflareApiToken = String(cfg.apiToken);
      } catch {
        parseError ??= fail(
          "CLI_FLAG_VALUE_INVALID",
          "--cloudflare-config must be a JSON object.",
          `Example: --cloudflare-config '{"auth":"api-token","accountId":"...","apiToken":"..."}'`
        );
      }
    } else if (value === "--cloudflare-auth") {
      const parsed = flagValue(index, value);
      flags.cloudflareAuth = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-account-id") {
      const parsed = flagValue(index, value);
      flags.cloudflareAccountId = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-zone-id") {
      const parsed = flagValue(index, value);
      flags.cloudflareZoneId = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-preview-base-domain") {
      const parsed = flagValue(index, value);
      flags.cloudflarePreviewBaseDomain = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-connection-id") {
      const parsed = flagValue(index, value);
      flags.cloudflareConnectionId = parsed.value;
      index = parsed.index;
    } else if (value === "--cloudflare-api-token") {
      const parsed = flagValue(index, value);
      flags.cloudflareApiToken = parsed.value;
      index = parsed.index;
    } else if (value === "--output" || value === "--out") {
      const parsed = flagValue(index, value);
      flags.output = parsed.value;
      index = parsed.index;
    } else if (value === "--input" || value === "--from") {
      const parsed = flagValue(index, value);
      flags.input = parsed.value;
      index = parsed.index;
    } else if (value === "--deployment-id") {
      const parsed = flagValue(index, value);
      flags.deploymentId = parsed.value;
      index = parsed.index;
    } else if (value === "--timeout") {
      const parsed = flagValue(index, value, String(flags.timeoutMs));
      const timeoutMs = parseDurationMs(parsed.value);
      if (timeoutMs === null && !parseError) {
        parseError = fail(
          "CLI_FLAG_VALUE_INVALID",
          `Invalid timeout value: ${parsed.value}.`,
          "Use a timeout like 1000ms, 30s, or 10m."
        );
      }
      flags.timeoutMs = timeoutMs ?? flags.timeoutMs;
      index = parsed.index;
    } else if (value === "--host") {
      const parsed = flagValue(index, value, flags.host);
      flags.host = parsed.value;
      index = parsed.index;
    } else if (value === "--port") {
      const parsed = flagValue(index, value, flags.port);
      flags.port = parsed.value;
      index = parsed.index;
    } else if (value.startsWith("-")) {
      parseError ??= fail(
        "CLI_UNKNOWN_OPTION",
        `Unknown option: ${value}.`,
        "Run `microservices --help` or `microservices deploy --help-all` for supported flags.",
        { option: value }
      );
    } else {
      args.push(value);
    }
  }

  return { args, flags, error: parseError };
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

function parseModuleSelector(value, explicitVersion = null, flagName = "--version") {
  const raw = String(value ?? "").trim();
  const at = raw.lastIndexOf("@");
  const selector = at > 0
    ? { id: raw.slice(0, at), version: raw.slice(at + 1) || null }
    : { id: raw, version: null };
  const flagVersion = explicitVersion ? String(explicitVersion).trim() : null;
  if (selector.version && flagVersion && selector.version !== flagVersion) {
    return {
      ok: false,
      response: fail(
        "MODULE_VERSION_CONFLICT",
        `Conflicting versions requested for module ${selector.id}.`,
        `Use either module@version or ${flagName}, not both with different versions.`,
        { moduleId: selector.id, inlineVersion: selector.version, explicitVersion: flagVersion }
      )
    };
  }
  return { ok: true, id: selector.id, version: flagVersion ?? selector.version };
}

function moduleSourceVersion(src) {
  const modulePkg = readJson(join(src, "package.json"), {});
  const moduleManifest = readJson(join(src, "module.json"), {});
  return modulePkg.version ?? moduleManifest.version ?? null;
}

function moduleReleaseTag(id, version) {
  return `modules/${id}/v${version}`;
}

function moduleSourceRef(id, version) {
  return {
    type: "git",
    repo: SOURCE_REPO,
    url: SOURCE_URL,
    tag: moduleReleaseTag(id, version),
    ref: `refs/tags/${moduleReleaseTag(id, version)}`,
    path: `modules/${id}`
  };
}

function rewriteFirstPartyDependencySet(dependencies, modulePrefix = "..", packagePrefix = "../../packages") {
  if (!dependencies || typeof dependencies !== "object") return;
  for (const name of Object.keys(dependencies)) {
    if (!name.startsWith(FIRST_PARTY_SCOPE)) continue;
    const id = name.slice(FIRST_PARTY_SCOPE.length);
    if (BUNDLED_PACKAGES.has(id)) {
      dependencies[name] = `file:${packagePrefix}/${BUNDLED_PACKAGES.get(id)}`;
    } else {
      dependencies[name] = `file:${modulePrefix}/${id}`;
    }
  }
}

function normalizeVendoredModulePackage(moduleDir) {
  const packagePath = join(moduleDir, "package.json");
  if (!existsSync(packagePath)) return;
  const pkg = readJson(packagePath, null);
  if (!pkg || typeof pkg !== "object") return;
  for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    rewriteFirstPartyDependencySet(pkg[group]);
  }
  writeJsonFile(packagePath, pkg);
}

function unavailableModuleVersion(id, requestedVersion, availableVersions = [], details = {}) {
  return fail(
    "MODULE_VERSION_NOT_FOUND",
    `Module ${id}@${requestedVersion} is not available from the current source snapshot.`,
    "Use one of the available versions or omit the version. Versioned historical installs need a registry artifact or release-tag source.",
    { moduleId: id, requestedVersion, availableVersions, ...details }
  );
}

function cloneModuleRepository(repoDir, selector) {
  const preferredSourceRef = selector.version ? moduleSourceRef(selector.id, selector.version) : null;

  if (preferredSourceRef) {
    try {
      mkdirSync(repoDir, { recursive: true });
      execFileSync("git", ["init", "-q", repoDir], { stdio: "pipe" });
      execFileSync("git", ["-C", repoDir, "remote", "add", "origin", SOURCE_URL], { stdio: "pipe" });
      execFileSync("git", ["-C", repoDir, "fetch", "--depth", "1", "origin", preferredSourceRef.ref], { stdio: "pipe" });
      execFileSync("git", ["-C", repoDir, "checkout", "--detach", "FETCH_HEAD"], { stdio: "pipe" });
      return {
        ok: true,
        preferredSourceRef,
        sourceResolution: "release-tag",
      };
    } catch (error) {
      return {
        ok: false,
        response: fail(
          "MODULE_SOURCE_REF_NOT_FOUND",
          `Module source ref was not found: ${preferredSourceRef.ref}.`,
          "Publish the module release tag, choose an available version, or omit the version to use the current source snapshot.",
          {
            moduleId: selector.id,
            requestedVersion: selector.version,
            sourceRef: preferredSourceRef,
            reason: String(error?.message ?? error).slice(0, 240)
          }
        )
      };
    }
  }

  execFileSync("git", ["clone", "-q", "--no-tags", "--depth", "1", SOURCE_URL, repoDir], { stdio: "pipe" });
  return {
    ok: true,
    preferredSourceRef,
    sourceResolution: "current-snapshot"
  };
}

function resolveModuleSource(selector, tmpPrefix = "ms-module-") {
  const tmp = mkdtempSync(join(tmpdir(), tmpPrefix));
  const repoDir = join(tmp, "repo");
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });

  try {
    const sourceResolution = cloneModuleRepository(repoDir, selector);
    if (!sourceResolution.ok) {
      cleanup();
      return sourceResolution;
    }

    const src = join(repoDir, "modules", selector.id);
    if (!existsSync(src)) {
      cleanup();
      return {
        ok: false,
        response: fail(
          "MODULE_NOT_FOUND",
          `Unknown module: ${selector.id}.`,
          "Run microservices modules list, or browse modules/ in microservices-sh/microservices-sh.",
          { id: selector.id }
        )
      };
    }

    normalizeVendoredModulePackage(src);
    const ref = execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const integrity = integrityOf(src);
    const version = moduleSourceVersion(src);
    const availableVersions = version ? [version] : [];
    const resolvedSourceRef = sourceResolution.preferredSourceRef ?? (version ? moduleSourceRef(selector.id, version) : null);
    if (selector.version && version !== selector.version) {
      cleanup();
      return {
        ok: false,
        response: unavailableModuleVersion(selector.id, selector.version, availableVersions, {
          sourceRef: sourceResolution.preferredSourceRef,
          sourceResolution: sourceResolution.sourceResolution,
          resolvedRef: ref
        })
      };
    }

    return {
      ok: true,
      tmp,
      repoDir,
      src,
      ref,
      integrity,
      version,
      availableVersions,
      resolvedSourceRef,
      sourceResolution: sourceResolution.sourceResolution,
      cleanup
    };
  } catch (error) {
    cleanup();
    return {
      ok: false,
      response: fail(
        "MODULE_SOURCE_UNAVAILABLE",
        `Could not resolve module source for ${selector.id}.`,
        "Confirm git is installed, network access is available, and the module source repository is reachable.",
        { moduleId: selector.id, requestedVersion: selector.version ?? null, reason: String(error?.message ?? error).slice(0, 240) }
      )
    };
  }
}

function compareVersions(a, b) {
  if (a === b) return 0;
  const left = String(a ?? "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  const right = String(b ?? "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (left && right) {
    for (let index = 1; index <= 3; index += 1) {
      const l = Number(left[index]);
      const r = Number(right[index]);
      if (l !== r) return l < r ? -1 : 1;
    }
    return 0;
  }
  return String(a) < String(b) ? -1 : 1;
}

function versionDirection(currentVersion, targetVersion) {
  const comparison = compareVersions(currentVersion, targetVersion);
  if (comparison < 0) return "upgrade";
  if (comparison > 0) return "downgrade";
  return "none";
}

// Copies a resolved module source into modules/<id> and records it in the lock.
// `source` carries { src, version, ref, integrity, resolvedSourceRef, sourceResolution }.
// Shared by `add` (clone-per-module) and `install` (one shared clone).
function vendorFromSource(id, source) {
  const dest = resolve("modules", id);
  mkdirSync(dest, { recursive: true });
  cpSync(source.src, dest, {
    recursive: true,
    filter: (entry) => !entry.split(/[\\/]/).some((part) => IGNORE.has(part))
  });
  normalizeVendoredModulePackage(dest);

  const lockPath = "microservices.lock.json";
  const lockData = readJson(lockPath, { modules: [] });
  lockData.modules = (lockData.modules ?? []).filter((module) => module.id !== id);
  lockData.modules.push({
    id,
    version: source.version,
    source: `registry:${id}@${source.version}`,
    sourceRef: source.resolvedSourceRef,
    repo: SOURCE_REPO,
    url: SOURCE_URL,
    ref: source.ref,
    sourceResolution: source.sourceResolution,
    path: `modules/${id}`,
    integrity: source.integrity
  });
  writeJsonFile(lockPath, lockData);

  return {
    id,
    vendoredTo: `modules/${id}`,
    integrity: source.integrity,
    version: source.version,
    source: SOURCE_REPO,
    sourceUrl: SOURCE_URL,
    sourceRef: source.resolvedSourceRef,
    sourceResolution: source.sourceResolution
  };
}

async function addModule(id, flags = {}) {
  if (!id) {
    return fail("MODULE_ID_REQUIRED", "Missing module id.", "Run microservices add <module-id>.");
  }

  const selector = parseModuleSelector(id, flags.version, "--version");
  if (!selector.ok) return selector.response;

  const source = resolveModuleSource(selector, "ms-add-");
  if (!source.ok) return source.response;

  try {
    // --plan is read-only: report what `add` would do without touching the project.
    if (flags.plan) {
      return {
        ok: true,
        data: {
          id: selector.id,
          plan: true,
          version: source.version,
          requestedVersion: selector.version ?? source.version,
          availableVersions: source.availableVersions,
          sourceRef: source.resolvedSourceRef,
          sourceResolution: source.sourceResolution,
          source: SOURCE_REPO,
          sourceUrl: SOURCE_URL,
          ref: source.ref,
          integrity: source.integrity,
          wouldVendorTo: `modules/${selector.id}`,
          dependency: `"@microservices-sh/${selector.id}": "file:./modules/${selector.id}"`
        },
        warnings: [
          `Plan only — nothing written. Re-run "microservices add ${selector.id}" (no --plan) to vendor it into modules/${selector.id}.`
        ]
      };
    }

    return {
      ok: true,
      data: vendorFromSource(selector.id, source),
      warnings: [
        `Add "@microservices-sh/${selector.id}": "file:./modules/${selector.id}" to dependencies and reinstall to wire it in.`
      ]
    };
  } finally {
    source.cleanup();
  }
}

// The shim has no resolver, so a module's dependencies are read from its
// vendored module.json. Always returns an array (missing file/field -> []).
function vendoredModuleRequires(manifestPath) {
  const requires = readJson(manifestPath, {})?.connections?.requires ?? [];
  return Array.isArray(requires) ? requires : [];
}

async function removeModule(id, flags = {}) {
  if (!id) {
    return fail("MODULE_ID_REQUIRED", "Missing module id.", "Run microservices remove <module-id>.");
  }
  const baseId = String(id).split("@")[0];

  const lockPath = "microservices.lock.json";
  const lockData = readJson(lockPath, { modules: [] });
  const modules = lockData.modules ?? [];
  const entry = modules.find((module) => module.id === baseId);
  if (!entry) {
    return fail(
      "MODULE_NOT_INSTALLED",
      `Module ${baseId} is not installed.`,
      "Run microservices modules list to see installed modules.",
      { moduleId: baseId }
    );
  }

  // Dependency guard: refuse if another installed module still requires this one.
  // The shim has no resolver, so read each remaining module's vendored module.json.
  const dependents = [];
  for (const other of modules) {
    if (other.id === baseId) continue;
    const manifestPath = resolve(other.path ?? `modules/${other.id}`, "module.json");
    if (vendoredModuleRequires(manifestPath).includes(baseId)) dependents.push(other.id);
  }
  if (dependents.length) {
    return fail(
      "MODULE_REQUIRED",
      `Cannot remove ${baseId}; still required by ${dependents.join(", ")}.`,
      "Remove the dependent module(s) first.",
      { moduleId: baseId, dependents }
    );
  }

  // --plan is read-only: report what `remove` would do without touching the project.
  if (flags.plan) {
    return {
      ok: true,
      data: {
        id: baseId,
        plan: true,
        version: entry.version ?? null,
        wouldRemoveDir: `modules/${baseId}`,
        lockEntry: entry.version ? `${baseId}@${entry.version}` : baseId
      },
      warnings: [
        `Plan only — nothing removed. Re-run "microservices remove ${baseId}" (no --plan) to delete modules/${baseId} and its lockfile entry.`
      ]
    };
  }

  // Local-change guard: do not delete user-modified source without --confirm overwrite.
  const dest = resolve("modules", baseId);
  if (existsSync(dest)) {
    const expectedIntegrity = entry.integrity ?? entry.checksum ?? null;
    if (expectedIntegrity) {
      const currentIntegrity = integrityOf(dest);
      if (currentIntegrity !== expectedIntegrity && flags.confirm !== "overwrite") {
        return fail(
          "MODULE_LOCAL_CHANGES",
          `Local changes were detected in modules/${baseId}.`,
          `Review or commit your changes, then rerun with --confirm overwrite to remove modules/${baseId} anyway.`,
          {
            moduleId: baseId,
            path: `modules/${baseId}`,
            expectedIntegrity,
            currentIntegrity,
            confirmationRequired: "overwrite"
          }
        );
      }
    }
    rmSync(dest, { recursive: true, force: true });
  }

  lockData.modules = modules.filter((module) => module.id !== baseId);
  writeJsonFile(lockPath, lockData);

  return {
    ok: true,
    data: {
      id: baseId,
      removed: baseId,
      removedDir: `modules/${baseId}`,
      version: entry.version ?? null
    },
    warnings: [
      `Remove "@microservices-sh/${baseId}": "file:./modules/${baseId}" from dependencies and reinstall.`
    ]
  };
}

// Reads the editable intent file (microservices.config.json). When absent,
// bootstraps it from the current lock + template manifest so `install` and
// `add`/`remove` have a consistent starting point in existing apps.
function loadShimConfig() {
  const configPath = "microservices.config.json";
  const existing = readJson(configPath, null);
  if (existing && Array.isArray(existing.modules)) {
    return { path: configPath, existed: true, config: existing };
  }
  const lockNow = readJson("microservices.lock.json", { modules: [] });
  const modules = (lockNow.modules ?? []).map((module) =>
    module.version ? `${module.id}@${module.version}` : module.id
  );
  return {
    path: configPath,
    existed: false,
    config: { template: manifest.id ?? lockNow.template ?? "", modules }
  };
}

// Records explicit user intent in microservices.config.json. Called only from
// the top-level add/remove commands, never from install's transitive vendoring,
// so dependencies stay implicit (in the lock) and intent stays what the user asked for.
function recordModuleIntent(ref, { removed = false } = {}) {
  const loaded = loadShimConfig();
  const baseId = String(ref).split("@")[0];
  const modules = (loaded.config.modules ?? []).filter(
    (entry) => String(entry).split("@")[0] !== baseId
  );
  if (!removed) modules.push(ref);
  const config = { ...loaded.config, modules };
  writeJsonFile(loaded.path, config);
  return config;
}

// Reconciles the project against microservices.config.json: vendors every
// listed module that is missing, then walks each vendored module.json's
// connections.requires to pull in transitive dependencies (the shim has no
// SDK resolver, so dependencies are discovered by reading vendored sources).
async function installModules(flags = {}) {
  const loaded = loadShimConfig();
  const queue = [...(loaded.config.modules ?? [])];
  const seen = new Set();
  const installed = [];
  const failed = [];

  // One shared HEAD clone serves every current-snapshot module. It is created
  // lazily on the first module that actually needs vendoring, so an
  // already-satisfied project (every module present) clones nothing.
  const tmp = mkdtempSync(join(tmpdir(), "ms-install-"));
  const sharedRepo = join(tmp, "repo");
  let sharedClone = null; // { ok, ref } once cloned
  function ensureSharedClone() {
    if (sharedClone) return sharedClone;
    const clone = cloneModuleRepository(sharedRepo, { id: "_shared", version: null });
    if (!clone.ok) {
      sharedClone = { ok: false, response: clone.response };
      return sharedClone;
    }
    const ref = execFileSync("git", ["-C", sharedRepo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    sharedClone = { ok: true, ref };
    return sharedClone;
  }

  // Vendors one module from the shared clone. Normalises the source before
  // hashing so integrity matches what `add` records (resolveModuleSource does
  // the same). A pin that doesn't match the current snapshot falls back to a
  // per-module release-tag fetch via addModule.
  async function vendorOne(id, requestedVersion) {
    const clone = ensureSharedClone();
    if (!clone.ok) return { ok: false, error: clone.response.error };

    const src = join(sharedRepo, "modules", id);
    if (!existsSync(src)) {
      return {
        ok: false,
        error: fail(
          "MODULE_NOT_FOUND",
          `Unknown module: ${id}.`,
          "Run microservices modules list, or browse modules/ in microservices-sh/microservices-sh.",
          { id }
        ).error
      };
    }

    normalizeVendoredModulePackage(src);
    const version = moduleSourceVersion(src);
    if (requestedVersion && version !== requestedVersion) {
      const fallback = await addModule(`${id}@${requestedVersion}`, {});
      return fallback.ok ? { ok: true, version: fallback.data.version } : { ok: false, error: fallback.error };
    }

    const data = vendorFromSource(id, {
      src,
      version,
      ref: clone.ref,
      integrity: integrityOf(src),
      resolvedSourceRef: version ? moduleSourceRef(id, version) : null,
      sourceResolution: "current-snapshot"
    });
    return { ok: true, version: data.version };
  }

  try {
    while (queue.length) {
      const ref = String(queue.shift());
      const baseId = ref.split("@")[0];
      if (!baseId || seen.has(baseId)) continue;
      seen.add(baseId);

      const requestedVersion = ref.includes("@") ? ref.split("@")[1] : null;
      const dest = resolve("modules", baseId);
      const lockNow = readJson("microservices.lock.json", { modules: [] });
      const lockEntry = (lockNow.modules ?? []).find((module) => module.id === baseId);

      if (existsSync(dest) && lockEntry) {
        installed.push({ id: baseId, status: "present", version: lockEntry.version ?? null });
      } else {
        const result = await vendorOne(baseId, requestedVersion);
        if (!result.ok) {
          failed.push({ id: baseId, error: result.error });
          continue;
        }
        installed.push({ id: baseId, status: "vendored", version: result.version });
      }

      // Enqueue transitive requires from the (now) vendored module.json.
      for (const dep of vendoredModuleRequires(join(dest, "module.json"))) {
        if (dep && !seen.has(dep)) queue.push(dep);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (failed.length) {
    return {
      ok: false,
      data: { template: loaded.config.template ?? null, installed, modules: [...seen], failed },
      error: {
        code: "INSTALL_INCOMPLETE",
        message: `Could not vendor ${failed.length} module(s): ${failed.map((entry) => entry.id).join(", ")}.`,
        remediation: "Check the module ids in microservices.config.json and retry.",
        details: { failed }
      }
    };
  }

  return {
    ok: true,
    data: { template: loaded.config.template ?? null, installed, modules: [...seen], failed }
  };
}

function localModuleVersion(id) {
  const moduleDir = resolve("modules", id);
  if (!existsSync(moduleDir)) return null;
  return moduleSourceVersion(moduleDir);
}

function moduleLockEntryFromSource(id, source, existing = {}) {
  const entry = {
    ...existing,
    id,
    version: source.version,
    source: `registry:${id}@${source.version}`,
    sourceRef: source.resolvedSourceRef,
    repo: SOURCE_REPO,
    url: SOURCE_URL,
    ref: source.ref,
    sourceResolution: source.sourceResolution,
    path: `modules/${id}`,
    integrity: source.integrity
  };
  delete entry.checksum;
  return entry;
}

function moduleLocalChangeCheck(id, module, flags = {}) {
  const dest = resolve("modules", id);
  if (!existsSync(dest)) {
    return {
      ok: false,
      response: fail(
        "MODULE_SOURCE_MISSING",
        `Module ${id} is listed in the lockfile but modules/${id} is missing.`,
        `Run microservices add ${id}@${module.version} to restore it, or remove the stale lockfile entry.`,
        { moduleId: id, path: `modules/${id}` }
      )
    };
  }

  const currentIntegrity = integrityOf(dest);
  const expectedIntegrity = module.integrity ?? module.checksum ?? null;
  if (expectedIntegrity && currentIntegrity !== expectedIntegrity && flags.confirm !== "overwrite") {
    return {
      ok: false,
      response: fail(
        "MODULE_LOCAL_CHANGES",
        `Local changes were detected in modules/${id}.`,
        `Review or commit your changes, then rerun with --confirm overwrite if replacing modules/${id} is intended.`,
        {
          moduleId: id,
          path: `modules/${id}`,
          expectedIntegrity,
          currentIntegrity,
          confirmationRequired: "overwrite"
        }
      )
    };
  }

  return {
    ok: true,
    currentIntegrity,
    expectedIntegrity,
    guarded: Boolean(expectedIntegrity),
    overwrittenLocalChanges: Boolean(expectedIntegrity && currentIntegrity !== expectedIntegrity && flags.confirm === "overwrite")
  };
}

function moduleUpgradePlan(id, flags = {}) {
  if (!id) {
    return fail("MODULE_ID_REQUIRED", "Missing module id.", "Run microservices upgrade <module-id> --plan.");
  }

  const selector = parseModuleSelector(id, flags.to ?? flags.version, flags.to ? "--to" : "--version");
  if (!selector.ok) return selector.response;

  const module = (lock.modules ?? []).find((item) => item.id === selector.id);
  if (!module) {
    return fail(
      "MODULE_NOT_INSTALLED",
      "Module not installed.",
      "Run microservices modules list to see installed modules.",
      { moduleId: selector.id }
    );
  }

  const source = resolveModuleSource(selector, "ms-upgrade-plan-");
  if (!source.ok) return source.response;

  try {
    const targetVersion = selector.version ?? source.version ?? module.version;
    const targetSourceRef = source.resolvedSourceRef ?? moduleSourceRef(selector.id, targetVersion);
    const direction = versionDirection(module.version, targetVersion);
    const versionChangeAvailable = direction !== "none";

    return {
      ok: true,
      data: {
        module: {
          id: module.id,
          currentVersion: module.version,
          targetVersion,
          requestedVersion: selector.version ?? targetVersion,
          availableVersions: source.availableVersions
        },
        action: direction === "none" ? "no-op" : `${direction}-plan`,
        direction,
        upgradeAvailable: versionChangeAvailable,
        versionChangeAvailable,
        approvalRequired: false,
        sourceResolution: source.sourceResolution,
        lockfile: {
          template: lock.template,
          source: module.source ?? module.repo ?? null,
          sourceRef: module.sourceRef ?? null,
          targetSourceRef,
          targetRef: source.ref,
          targetIntegrity: source.integrity,
          checksum: module.checksum ?? module.integrity ?? null,
          contractSnapshotAvailable: Boolean(module.contract)
        },
        nextSteps: versionChangeAvailable
          ? [
              `Review this ${direction} plan before modifying source.`,
              `Run microservices upgrade ${selector.id}${selector.version ? ` --to ${selector.version}` : ""} --json to replace modules/${selector.id}.`,
              "Run microservices check --json and the app typecheck after applying."
            ]
          : [
              "The installed module already matches the requested version.",
              "Run microservices updates --json later to check again."
            ]
      }
    };
  } finally {
    source.cleanup();
  }
}

function applyModuleUpgrade(id, flags = {}) {
  if (!id) {
    return fail("MODULE_ID_REQUIRED", "Missing module id.", "Run microservices upgrade <module-id> [--to <version>].");
  }

  const selector = parseModuleSelector(id, flags.to ?? flags.version, flags.to ? "--to" : "--version");
  if (!selector.ok) return selector.response;

  const module = (lock.modules ?? []).find((item) => item.id === selector.id);
  if (!module) {
    return fail(
      "MODULE_NOT_INSTALLED",
      "Module not installed.",
      "Run microservices modules list to see installed modules.",
      { moduleId: selector.id }
    );
  }

  const source = resolveModuleSource(selector, "ms-upgrade-");
  if (!source.ok) return source.response;

  try {
    const localCheck = moduleLocalChangeCheck(selector.id, module, flags);
    if (!localCheck.ok) return localCheck.response;

    const targetVersion = selector.version ?? source.version ?? module.version;
    const direction = versionDirection(module.version, targetVersion);
    const dest = resolve("modules", selector.id);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(source.src, dest, {
      recursive: true,
      filter: (sourcePath) => !sourcePath.split(/[\\/]/).some((part) => IGNORE.has(part))
    });
    normalizeVendoredModulePackage(dest);

    const lockPath = "microservices.lock.json";
    const lockData = readJson(lockPath, { modules: [] });
    const modules = Array.isArray(lockData.modules) ? lockData.modules : [];
    const existingIndex = modules.findIndex((item) => item.id === selector.id);
    const existing = existingIndex >= 0 ? modules[existingIndex] : module;
    const nextEntry = moduleLockEntryFromSource(selector.id, source, existing);
    if (existingIndex >= 0) modules[existingIndex] = nextEntry;
    else modules.push(nextEntry);
    lockData.modules = modules;
    writeJsonFile(lockPath, lockData);

    const warnings = [
      "Run microservices check --json and the app typecheck after applying module source changes."
    ];
    if (!localCheck.guarded) {
      warnings.unshift(`No prior integrity was recorded for modules/${selector.id}; local-change protection was limited.`);
    }
    if (localCheck.overwrittenLocalChanges) {
      warnings.unshift(`Replaced local changes in modules/${selector.id} because --confirm overwrite was provided.`);
    }

    return {
      ok: true,
      data: {
        id: selector.id,
        action: direction === "none" ? "reinstall" : direction,
        direction,
        currentVersion: module.version,
        targetVersion,
        requestedVersion: selector.version ?? targetVersion,
        vendoredTo: `modules/${selector.id}`,
        integrity: source.integrity,
        previousIntegrity: localCheck.currentIntegrity,
        source: SOURCE_REPO,
        sourceUrl: SOURCE_URL,
        sourceRef: source.resolvedSourceRef,
        sourceResolution: source.sourceResolution,
        ref: source.ref
      },
      warnings
    };
  } finally {
    source.cleanup();
  }
}

function checkResponse() {
  // Universal base checks (every template ships these). Template-specific file
  // checks are declared in microservices.template.json `checks: [{id, file}]`
  // so this shim stays identical across templates (see workspace-tools shims).
  const declared = Array.isArray(manifest.checks) ? manifest.checks : [];
  const checks = [
    { id: "manifest", status: existsSync("microservices.template.json") ? "pass" : "fail" },
    { id: "lockfile", status: existsSync("microservices.lock.json") ? "pass" : "fail" },
    { id: "api-boundary", status: existsSync("docs/api-boundary.md") ? "pass" : "fail" },
    { id: "wrangler-config", status: existsSync(wranglerConfigPath) ? "pass" : "fail" },
    ...declared
      .filter((check) => check && typeof check.id === "string" && typeof check.file === "string")
      .map((check) => ({ id: check.id, status: existsSync(check.file) ? "pass" : "fail" })),
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

// Scaffold .dev.vars from .dev.vars.example on the first local run, so a fresh
// clone has the env it needs (e.g. ADMIN_EMAILS for the first super-admin)
// without a manual copy step. No-op when .dev.vars exists or no example ships.
function ensureDevVars(flags) {
  if (existsSync(".dev.vars") || !existsSync(".dev.vars.example")) return;
  writeFileSync(".dev.vars", readFileSync(".dev.vars.example"));
  if (!flags.json) {
    process.stderr.write("Created .dev.vars from .dev.vars.example. Edit it (e.g. ADMIN_EMAILS) for local dev.\n");
  }
}

// Announce which store layer local dev uses, so the persistence model is never
// a surprise. D1 (local) persists under .wrangler/state; the in-memory fallback
// resets on restart.
function localStoreBanner(flags) {
  if (flags.json) return;
  process.stderr.write(
    localRequiresD1
      ? "Local stores: D1 (local), persisted in .wrangler/state.\n"
      : "Local stores: in-memory, reset on restart.\n"
  );
}

function localSetup(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  ensureDevVars(flags);

  const steps = [{ id: "local:build", command: "vite", args: ["build"] }];
  if (localRequiresD1) {
    steps.push({ id: "local:migrate", command: "wrangler", args: localD1MigrationArgs });
  }

  return runSteps(steps, flags, [
    "Run microservices local dev, optionally microservices local seed, then microservices local smoke in another terminal."
  ]);
}

function localDev(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  ensureDevVars(flags);

  if (localRequiresD1) {
    const migrated = runCommand("local:migrate", "wrangler", localD1MigrationArgs, flags);
    if (!migrated.ok) return migrated;
  }

  localStoreBanner(flags);

  return runCommand("local:dev", "vite", ["dev", "--host", flags.host, "--port", flags.port, "--strictPort"], flags);
}

function localMigrate(flags) {
  if (!localRequiresD1) {
    return {
      ok: true,
      data: {
        id: "local:migrate",
        command: "skipped",
        exitCode: 0,
        skipped: true,
        reason: "This remote-API app uses the hosted microservices.sh API and owns no local D1 migrations."
      }
    };
  }
  return runCommand("local:migrate", "wrangler", localD1MigrationArgs, flags);
}

// Run the app's optional seed script to populate local dev data. Kept app-owned
// and idempotent: scripts/seed.mjs decides how to seed (HTTP against the running
// dev server, or wrangler d1 execute --local). The CLI only owns discovery + run.
function localSeed(flags) {
  const checks = checkResponse();
  if (!checks.ok) return checks;

  if (!existsSync("scripts/seed.mjs")) {
    return fail(
      "SEED_NOT_FOUND",
      "No scripts/seed.mjs to run.",
      "Add an idempotent scripts/seed.mjs that populates local dev data (POST to the running dev server, or wrangler d1 execute --local).",
      {}
    );
  }

  return runCommand("local:seed", "node", ["scripts/seed.mjs"], flags);
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

function requireCiApiKey(flags, action) {
  const settings = resolvedApiSettings(flags);
  if (!flags.ci || settings.apiKey) return null;

  return fail(
    "CI_API_KEY_REQUIRED",
    `CI ${action} requires MICROSERVICES_API_KEY or --api-key.`,
    "Create a workspace API key and store it as a CI secret."
  );
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeSetupRelativePath(value) {
  const normalized = cleanString(value)?.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return null;
  if (parts.some((part) => [".git", ".wrangler", "node_modules"].includes(part))) return null;
  if (parts.some((part) => part === ".env" || part.startsWith(".env."))) return null;
  return parts.join("/");
}

function getPathValue(value, path) {
  let cursor = value;
  for (const part of path) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
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

function presentSetupValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergeRecords(base, patch) {
  const next = isRecord(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    next[key] = isRecord(value) && isRecord(next[key]) ? mergeRecords(next[key], value) : value;
  }
  return next;
}

function setupDefaultStore(target) {
  return target.kind === "template" && isRecord(target.interactive?.stores) && target.interactive.stores.content
    ? "content"
    : "config";
}

function schemaType(schema) {
  if (Array.isArray(schema?.type)) return schema.type.find((value) => value !== "null") ?? schema.type[0] ?? null;
  return schema?.type ?? (schema?.enum ? "string" : null);
}

function setupSchemaFields(schema, parentPath = [], parentRequired = true, defaultStore = "config") {
  if (!isRecord(schema?.properties)) return [];

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields = [];

  for (const [name, definition] of Object.entries(schema.properties)) {
    if (!isRecord(definition)) continue;

    const path = [...parentPath, name];
    const type = schemaType(definition);
    const isRequired = parentRequired && required.has(name);

    if (type === "object" && isRecord(definition.properties)) {
      fields.push(...setupSchemaFields(definition, path, isRequired, defaultStore));
      continue;
    }

    fields.push({
      path,
      id: path.join("."),
      title: cleanString(definition.title) ?? path.join("."),
      prompt: cleanString(definition["x-prompt"]) ?? `Enter ${cleanString(definition.title) ?? path.join(".")}`,
      type: type ?? "string",
      required: isRequired,
      enum: Array.isArray(definition.enum) ? definition.enum : null,
      default: definition.default,
      store: cleanString(definition["x-store"]) ?? defaultStore,
      secretName: cleanString(definition["x-secret-name"]),
      provider: cleanString(definition["x-provider"]),
      sensitive: Boolean(definition["x-sensitive"]),
      pattern: cleanString(definition.pattern),
      format: cleanString(definition.format),
      minItems: Number.isInteger(definition.minItems) ? definition.minItems : null,
      maxItems: Number.isInteger(definition.maxItems) ? definition.maxItems : null,
      itemType: schemaType(definition.items ?? {})
    });
  }

  return fields;
}

function setupFieldSummary(field) {
  return {
    path: field.id,
    title: field.title,
    type: field.type,
    required: field.required,
    store: field.store,
    enum: field.enum ?? undefined,
    secretName: field.secretName ?? undefined,
    provider: field.provider ?? undefined,
    sensitive: field.sensitive || field.store === "secret" ? true : undefined
  };
}

function setupFieldSummaries(fields, store) {
  return fields.filter((field) => field.store === store).map(setupFieldSummary);
}

function setupDeclaredWrites(target) {
  const writes = [];

  if (target.kind === "template" && isRecord(target.interactive?.stores) && target.interactive.stores.content) {
    writes.push({ type: "content", path: target.interactive.stores.content });
  }

  if (target.kind === "module" && isRecord(target.interactive?.stores) && target.interactive.stores.config) {
    writes.push({ type: "config", path: target.interactive.stores.config, namespace: `modules.${target.id}` });
  }

  return writes;
}

function resolveSetupTarget(id) {
  const requested = cleanString(id);
  const templateId = cleanString(manifest.id) ?? cleanString(lock.template) ?? "commerce-ops-sveltekit";
  if (!requested || requested === "template" || requested === templateId) {
    return {
      ok: true,
      data: {
        kind: "template",
        id: templateId,
        manifest,
        interactive: isRecord(manifest.interactive) ? manifest.interactive : null,
        skills: Array.isArray(manifest.skills) ? manifest.skills : [],
        baseDir: ".",
        manifestPath: "microservices.template.json"
      }
    };
  }

  const modulePath = join("modules", requested, "module.json");
  if (existsSync(modulePath)) {
    const moduleManifest = readJson(modulePath, {});
    return {
      ok: true,
      data: {
        kind: "module",
        id: cleanString(moduleManifest.id) ?? requested,
        manifest: moduleManifest,
        interactive: isRecord(moduleManifest.interactive) ? moduleManifest.interactive : null,
        skills: Array.isArray(moduleManifest.skills) ? moduleManifest.skills : [],
        baseDir: join("modules", requested),
        manifestPath: modulePath
      }
    };
  }

  const locked = (lock.modules ?? []).find((module) => module?.id === requested);
  return fail(
    "SETUP_TARGET_NOT_FOUND",
    locked ? `Module "${requested}" is installed but its local manifest is missing.` : `No setup target found for "${requested ?? ""}".`,
    locked ? `Re-run microservices add ${requested}, then run setup again.` : "Run microservices modules list, or omit the id to set up the current template.",
    { target: requested, installedModules: (lock.modules ?? []).map((module) => module.id).filter(Boolean) }
  );
}

function loadSetupSchema(target) {
  if (!target.interactive) {
    return fail(
      "SETUP_NOT_AVAILABLE",
      `${target.kind} "${target.id}" does not declare interactive setup.`,
      "Choose a module/template with an interactive schema, or add interactive.schema to its manifest.",
      { target: target.id, manifestPath: target.manifestPath }
    );
  }

  const schemaRel = safeSetupRelativePath(target.interactive.schema);
  if (!schemaRel) {
    return fail(
      "SETUP_SCHEMA_MISSING",
      `${target.kind} "${target.id}" does not declare a valid interactive schema path.`,
      "Add interactive.schema with a safe relative JSON schema path.",
      { target: target.id, interactive: target.interactive }
    );
  }

  const schemaPath = join(target.baseDir, schemaRel);
  if (!existsSync(schemaPath)) {
    return fail(
      "SETUP_SCHEMA_NOT_FOUND",
      `Interactive setup schema not found: ${schemaPath}.`,
      "Restore the schema file or update interactive.schema in the manifest.",
      { target: target.id, schemaPath }
    );
  }

  try {
    return { ok: true, data: { schema: readJson(schemaPath, {}), schemaPath } };
  } catch (error) {
    return fail(
      "SETUP_SCHEMA_INVALID",
      `Could not parse setup schema: ${schemaPath}.`,
      "Fix the schema JSON and retry.",
      { target: target.id, schemaPath, cause: error.message }
    );
  }
}

function setupPlanData(target, schema, schemaPath) {
  const defaultStore = setupDefaultStore(target);
  const fields = setupSchemaFields(schema, [], true, defaultStore);
  const checklist = Array.isArray(schema["x-microservices"]?.checklist) ? schema["x-microservices"].checklist : [];

  return {
    status: "planned",
    target: { kind: target.kind, id: target.id },
    command: target.interactive?.command ?? `microservices setup ${target.id}`,
    mode: target.interactive?.mode ?? null,
    schema: schemaPath,
    fields: {
      content: setupFieldSummaries(fields, "content"),
      config: setupFieldSummaries(fields, "config"),
      secrets: setupFieldSummaries(fields, "secret"),
      checklist: setupFieldSummaries(fields, "checklist")
    },
    writes: setupDeclaredWrites(target),
    skills: target.skills,
    checklist,
    nextSteps: setupNextSteps(target, schema, fields)
  };
}

function setupNextSteps(target, schema, fields) {
  const steps = [];
  if (!target.interactive?.schema) steps.push("Add an interactive setup schema to this target.");
  const secretNames = fields.filter((field) => field.store === "secret").map((field) => field.secretName ?? field.id);
  for (const secretName of secretNames) steps.push(`Store ${secretName} in your runtime secret store.`);

  if (schema["x-microservices"]?.verify) {
    steps.push(`Verify with: ${schema["x-microservices"].verify}`);
  } else {
    steps.push("Run microservices check --json.");
  }

  return steps;
}

function readSetupInput(flags) {
  if (!flags.input) return { ok: true, data: null };

  try {
    const payload = readJson(resolve(flags.input), null);
    const data = isRecord(payload?.data?.input) ? payload.data.input : payload;
    if (!isRecord(data)) {
      return fail(
        "SETUP_INPUT_INVALID",
        "Setup input JSON must be an object.",
        "Pass a JSON object matching the setup schema.",
        { input: flags.input }
      );
    }
    return { ok: true, data };
  } catch (error) {
    return fail(
      "SETUP_INPUT_INVALID",
      "Could not read setup input JSON.",
      "Pass a valid JSON file with --input setup.json.",
      { input: flags.input, cause: error.message }
    );
  }
}

function parseSetupAnswer(value, field) {
  const text = String(value ?? "").trim();
  if (!text) return field.default;

  if (field.type === "boolean") {
    const lower = text.toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(lower)) return true;
    if (["0", "false", "no", "n", "off"].includes(lower)) return false;
    return Boolean(text);
  }

  if (field.type === "integer") {
    const number = Number.parseInt(text, 10);
    return Number.isFinite(number) ? number : text;
  }

  if (field.type === "number") {
    const number = Number(text);
    return Number.isFinite(number) ? number : text;
  }

  if (field.type === "array") {
    if (text.startsWith("[")) return JSON.parse(text);
    const items = text.split(",").map((item) => item.trim()).filter(Boolean);
    if (field.itemType === "object") {
      return items.map((item) => {
        const [name, ...rest] = item.split(":");
        const description = rest.join(":").trim() || name.trim();
        return { name: name.trim(), description };
      });
    }
    return items;
  }

  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return text;
}

async function promptForSetupInput(target, schema) {
  const defaultStore = setupDefaultStore(target);
  const fields = setupSchemaFields(schema, [], true, defaultStore).filter((field) => field.store !== "secret");
  const input = {};
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    process.stdout.write(`${target.id} setup\n`);
    for (const field of fields) {
      const choices = field.enum?.length ? ` (${field.enum.join("/")})` : "";
      const defaultText = field.default !== undefined ? ` [${field.default}]` : "";
      const requiredText = field.required && field.default === undefined ? " *" : "";
      const answer = await rl.question(`${field.prompt}${choices}${defaultText}${requiredText}: `);
      try {
        const parsed = parseSetupAnswer(answer, field);
        if (parsed !== undefined) setPathValue(input, field.path, parsed);
      } catch (error) {
        return fail(
          "SETUP_PROMPT_VALUE_INVALID",
          `Invalid value for ${field.id}.`,
          "For arrays/objects, enter valid JSON or a comma-separated list.",
          { field: field.id, cause: error.message }
        );
      }
    }
  } finally {
    rl.close();
  }

  return { ok: true, data: input };
}

function canPromptForSetup(flags) {
  return process.stdin.isTTY && process.stdout.isTTY && !flags.json && !flags.ci;
}

async function collectSetupInput(target, schema, schemaPath, flags) {
  if (flags.input) return readSetupInput(flags);
  if (canPromptForSetup(flags)) return promptForSetupInput(target, schema);

  return fail(
    "SETUP_INPUT_REQUIRED",
    "Interactive setup needs input.",
    "Run in an interactive terminal or pass --input setup.json.",
    { target: target.id, schema: schemaPath }
  );
}

function validateSetupInput(schema, input, target) {
  const defaultStore = setupDefaultStore(target);
  const fields = setupSchemaFields(schema, [], true, defaultStore);
  const missing = [];
  const invalid = [];

  for (const field of fields) {
    const value = getPathValue(input, field.path);
    if (field.required && !presentSetupValue(value)) {
      missing.push(field.id);
      continue;
    }
    if (!presentSetupValue(value)) continue;
    if (field.enum && !field.enum.includes(value)) invalid.push({ path: field.id, expected: field.enum, actual: value });
    if (field.type === "array") {
      if (!Array.isArray(value)) invalid.push({ path: field.id, expected: "array", actual: typeof value });
      else if (field.minItems !== null && value.length < field.minItems) invalid.push({ path: field.id, expected: `at least ${field.minItems} item(s)`, actual: value.length });
      else if (field.maxItems !== null && value.length > field.maxItems) invalid.push({ path: field.id, expected: `at most ${field.maxItems} item(s)`, actual: value.length });
    }
    if (field.type === "boolean" && typeof value !== "boolean") invalid.push({ path: field.id, expected: "boolean", actual: typeof value });
    if (field.pattern && typeof value === "string" && !new RegExp(field.pattern).test(value)) {
      invalid.push({ path: field.id, expected: field.pattern, actual: value });
    }
  }

  if (missing.length || invalid.length) {
    return fail(
      "SETUP_INPUT_INVALID",
      "Setup input does not match the interactive schema.",
      "Fill the required fields and retry.",
      { missing, invalid }
    );
  }

  return { ok: true, data: input };
}

function setupStoredValues(schema, input, target, store) {
  const fields = setupSchemaFields(schema, [], true, setupDefaultStore(target));
  const values = {};
  for (const field of fields) {
    if (field.store !== store) continue;
    const value = getPathValue(input, field.path);
    if (presentSetupValue(value)) setPathValue(values, field.path, value);
  }
  return values;
}

function setupSecrets(schema, input, target) {
  const fields = setupSchemaFields(schema, [], true, setupDefaultStore(target)).filter((field) => field.store === "secret");
  return fields.map((field) => ({
    field: field.id,
    name: field.secretName ?? field.id,
    provider: field.provider ?? null,
    providedInInput: presentSetupValue(getPathValue(input, field.path)),
    written: false
  }));
}

function truncateText(value, max) {
  const text = cleanString(value);
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function validHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizedOfferings(value, fallback = []) {
  const raw = Array.isArray(value) ? value : [];
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

function companyLandingPricingPlans(pricingPreference, existing, ctaHref) {
  if (pricingPreference !== "contact-only") return existing.pricing?.plans ?? [];

  return [
    { name: "Starter", price: "Let's talk", unit: "", bestFor: "Focused first step", features: ["Clear scope", "Fast turnaround", "Direct contact"], cta: { label: "Get started", href: ctaHref }, featured: false },
    { name: "Partner", price: "Custom", unit: "", bestFor: "Ongoing work", features: ["Roadmap support", "Regular delivery", "Priority help"], cta: { label: "Start a conversation", href: ctaHref }, featured: true },
    { name: "Enterprise", price: "Tailored", unit: "", bestFor: "Larger needs", features: ["Scoped program", "Stakeholder reviews", "Launch support"], cta: { label: "Contact us", href: ctaHref }, featured: false }
  ];
}

function companyLandingContentFromIntake(input, existing = {}) {
  const contact = isRecord(input.contact) ? input.contact : {};
  const brand = isRecord(input.brand) ? input.brand : {};
  const company = truncateText(input.company, 40) ?? existing.company ?? "Company";
  const description = truncateText(input.description, 200) ?? existing.description ?? `${company} helps customers get important work done.`;
  const targetCustomer = truncateText(input.targetCustomer, 80) ?? "teams that need dependable help";
  const offerings = normalizedOfferings(input.offerings, existing.features?.items ?? []).slice(0, 3);
  while (offerings.length < 3) {
    offerings.push({ name: ["Plan", "Build", "Support"][offerings.length], description: description });
  }

  const proof = Array.isArray(input.proof) ? input.proof.map((item) => truncateText(item, 40)).filter(Boolean) : [];
  const logoProof = proof.map((item) => truncateText(item, 24)).filter(Boolean);
  const email = cleanString(contact.email);
  const ctaHref = email ? `mailto:${email}` : existing.cta?.primary?.href ?? "#";
  const location = cleanString(contact.location);
  const accent = validHexColor(brand.accent) ? brand.accent : existing.theme?.accent ?? "#c14b27";
  const icons = ["engineering", "design", "performance"];
  const logoItems = logoProof.length >= 3 ? logoProof.slice(0, 6) : existing.logos?.items ?? ["Customers", "Partners", "Teams"];
  const pricingPreference = cleanString(input.pricingPreference) ?? "contact-only";
  const pricingPlans = companyLandingPricingPlans(pricingPreference, existing, ctaHref);

  return {
    ...existing,
    company,
    domain: cleanString(input.domain) ?? existing.domain ?? "https://example.com",
    description,
    theme: { ...(existing.theme ?? {}), accent },
    hero: {
      ...(existing.hero ?? {}),
      eyebrow: truncateText(location ? `${location} - ${company}` : company, 40) ?? company,
      titleLead: "Built for",
      titleEmphasis: truncateText(targetCustomer, 40) ?? "ambitious teams",
      titleTail: "that need clarity.",
      lead: truncateText(description, 240) ?? description,
      primary: { label: "Get in touch", href: ctaHref },
      secondary: { label: "See services", href: "#features" },
      note: truncateText(proof[0] ? `Trusted signal: ${proof[0]}` : `Practical help from ${company}.`, 80) ?? `Practical help from ${company}.`
    },
    logos: {
      ...(existing.logos ?? {}),
      label: proof.length >= 3 ? "Proof points" : existing.logos?.label ?? "Working with",
      items: logoItems
    },
    features: {
      ...(existing.features ?? {}),
      eyebrow: "What we do",
      title: "Services shaped around your work.",
      items: offerings.map((offering, index) => ({
        title: truncateText(offering.name, 40) ?? `Offering ${index + 1}`,
        body: truncateText(offering.description, 180) ?? description,
        icon: icons[index] ?? "engineering"
      }))
    },
    process: {
      ...(existing.process ?? {}),
      intro: truncateText(`We keep the work clear from first conversation to launch for ${targetCustomer}.`, 200) ?? existing.process?.intro
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
      title: truncateText(`Ready to talk to ${company}?`, 60) ?? "Ready to talk?",
      body: truncateText(`Tell us what you are trying to build, improve, or launch. ${company} will respond with a clear next step.`, 180) ?? description,
      primary: { label: "Contact us", href: ctaHref },
      secondary: { label: "Review services", href: "#features" }
    },
    footer: {
      ...(existing.footer ?? {}),
      groups: (existing.footer?.groups ?? []).map((group) => {
        if (group?.title !== "Company" || !Array.isArray(group.links)) return group;
        return {
          ...group,
          links: group.links.map((link) => link?.label === "Contact" ? { ...link, href: ctaHref } : link)
        };
      }),
      copyright: company
    }
  };
}

function applySetup(target, schema, input) {
  const written = [];
  const checklistValues = setupStoredValues(schema, input, target, "checklist");

  if (target.kind === "template" && target.id === "company-landing-astro" && target.interactive?.stores?.content) {
    const contentPath = safeSetupRelativePath(target.interactive.stores.content);
    if (!contentPath) {
      return fail("SETUP_STORE_INVALID", "Template content store path is invalid.", "Fix interactive.stores.content in the template manifest.");
    }
    const existing = readJson(contentPath, {});
    const content = companyLandingContentFromIntake(input, existing);
    writeJsonFile(contentPath, content);
    written.push({ type: "content", path: contentPath });
  } else if (target.kind === "module") {
    const configValues = setupStoredValues(schema, input, target, "config");
    if (Object.keys(configValues).length) {
      const configPath = "microservices.config.json";
      const config = readJson(configPath, {});
      const modules = isRecord(config.modules) ? config.modules : {};
      const existing = isRecord(modules[target.id]) ? modules[target.id] : {};
      writeJsonFile(configPath, {
        ...config,
        modules: {
          ...modules,
          [target.id]: mergeRecords(existing, configValues)
        }
      });
      written.push({ type: "config", path: configPath, namespace: `modules.${target.id}` });
    }
  } else {
    const configValues = setupStoredValues(schema, input, target, "config");
    const contentValues = setupStoredValues(schema, input, target, "content");
    const values = Object.keys(contentValues).length ? contentValues : configValues;
    if (Object.keys(values).length) {
      const configPath = "microservices.config.json";
      const config = readJson(configPath, {});
      writeJsonFile(configPath, {
        ...config,
        setup: {
          ...(isRecord(config.setup) ? config.setup : {}),
          [target.id]: values
        }
      });
      written.push({ type: "config", path: configPath, namespace: `setup.${target.id}` });
    }
  }

  return {
    ok: true,
    data: {
      written,
      checklistValues,
      secrets: setupSecrets(schema, input, target)
    }
  };
}

async function setupResponse(id, flags) {
  const targetResponse = resolveSetupTarget(id);
  if (!targetResponse.ok) return targetResponse;

  const target = targetResponse.data;
  const schemaResponse = loadSetupSchema(target);
  if (!schemaResponse.ok) return schemaResponse;

  const { schema, schemaPath } = schemaResponse.data;
  const plan = setupPlanData(target, schema, schemaPath);
  if (flags.plan) return { ok: true, data: plan };

  const inputResponse = await collectSetupInput(target, schema, schemaPath, flags);
  if (!inputResponse.ok) return inputResponse;

  const validation = validateSetupInput(schema, inputResponse.data, target);
  if (!validation.ok) return validation;

  const applied = applySetup(target, schema, inputResponse.data);
  if (!applied.ok) return applied;

  const secretWarnings = applied.data.secrets
    .filter((secret) => secret.providedInInput)
    .map((secret) => `${secret.name} was provided in input but was not written; store it in the runtime secret store.`);

  return {
    ok: true,
    data: {
      ...plan,
      status: "configured",
      written: applied.data.written,
      secrets: applied.data.secrets,
      checklistValues: applied.data.checklistValues
    },
    warnings: secretWarnings
  };
}

function formatSetupResult(data) {
  const lines = [`${data.target.id}: ${data.status}`];
  if (data.schema) lines.push(`Schema: ${data.schema}`);
  if (data.written?.length) {
    lines.push("Written:");
    for (const item of data.written) lines.push(`- ${item.type}: ${item.path}${item.namespace ? ` (${item.namespace})` : ""}`);
  }
  if (data.secrets?.length) {
    lines.push("Secrets:");
    for (const secret of data.secrets) lines.push(`- ${secret.name}: store separately${secret.provider ? ` (${secret.provider})` : ""}`);
  }
  if (data.skills?.length) {
    lines.push("Suggested skills:");
    for (const skill of data.skills) lines.push(`- ${typeof skill === "string" ? skill : skill.id}`);
  }
  if (data.checklist?.length) {
    lines.push("Checklist:");
    for (const item of data.checklist) lines.push(`- ${item}`);
  }
  if (data.nextSteps?.length) {
    lines.push("Next:");
    for (const step of data.nextSteps) lines.push(`- ${step}`);
  }
  return `${lines.join("\n")}\n`;
}

function pathWithQuery(path, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = cleanString(value);
    if (normalized) search.set(key, normalized);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function logQuery(flags) {
  return {
    q: flags.search,
    level: flags.level,
    since: flags.since,
    limit: flags.limit
  };
}

function observabilityQuery(flags) {
  return {
    q: flags.search,
    level: flags.level,
    source: flags.source,
    eventType: flags.eventType,
    since: flags.since,
    before: flags.before,
    limit: flags.limit
  };
}

const MANAGED_DEPLOY_TARGETS = new Set(["managed", "microservices"]);
const CLOUDFLARE_DEPLOY_TARGETS = new Set(["cloudflare", "cf", "byo-cloudflare"]);
const CLOUDFLARE_AUTH_VALUES = new Set(["oauth", "api-token", "api_token", "token"]);

function deployTargetKind(flags) {
  const target = cleanString(flags.target)?.toLowerCase() ?? "managed";
  if (CLOUDFLARE_DEPLOY_TARGETS.has(target)) return "cloudflare";
  if (MANAGED_DEPLOY_TARGETS.has(target)) return "managed";
  return null;
}

function validateDeployFlags(flags) {
  const target = cleanString(flags.target)?.toLowerCase() ?? "managed";
  if (!deployTargetKind(flags)) {
    return fail(
      "DEPLOY_TARGET_INVALID",
      `Unknown deploy target: ${target}.`,
      "Use --target managed or --target cloudflare."
    );
  }

  const auth = cleanString(flags.cloudflareAuth)?.toLowerCase();
  if (auth && !CLOUDFLARE_AUTH_VALUES.has(auth)) {
    return fail(
      "CLOUDFLARE_AUTH_INVALID",
      `Unknown Cloudflare auth mode: ${auth}.`,
      "Use --cloudflare-auth oauth or --cloudflare-auth api-token."
    );
  }

  return null;
}

function cloudflareAuthKind(flags) {
  const rawAuth = cleanString(flags.cloudflareAuth)?.toLowerCase();
  if (rawAuth === "api-token" || rawAuth === "api_token" || rawAuth === "token") {
    return "api_token";
  }
  if (rawAuth === "oauth" || flags.cloudflareConnectionId) {
    return "oauth";
  }
  if (flags.cloudflareApiToken) {
    return "api_token";
  }
  return "oauth";
}

function deploymentTarget(flags) {
  if (deployTargetKind(flags) !== "cloudflare") {
    return {
      provider: "microservices",
      auth: "platform",
      accountId: null,
      connectionId: null,
      zoneId: null,
      previewBaseDomain: null,
      tokenStored: true
    };
  }

  const auth = cloudflareAuthKind(flags);

  return {
    provider: "cloudflare",
    auth,
    accountId: cleanString(flags.cloudflareAccountId),
    connectionId: cleanString(flags.cloudflareConnectionId),
    zoneId: cleanString(flags.cloudflareZoneId),
    previewBaseDomain: cleanString(flags.cloudflarePreviewBaseDomain),
    tokenStored: auth === "oauth"
  };
}

function cloudflareCredentialCheck(target, flags) {
  if (target.auth === "oauth") {
    return {
      id: "cloudflare-oauth-connection",
      status: target.connectionId ? "pass" : "warn",
      message: target.connectionId
        ? `Cloudflare OAuth connection id is configured: ${target.connectionId}.`
        : "OAuth target should include --cloudflare-connection-id after connecting Cloudflare in the portal."
    };
  }

  return {
    id: "cloudflare-api-token",
    status: flags.cloudflareApiToken ? "pass" : "warn",
    message: flags.cloudflareApiToken
      ? "Cloudflare API token is available for mutating deploy actions."
      : "API-token target must provide --cloudflare-api-token or CLOUDFLARE_API_TOKEN for provision/migrate/upload/cleanup."
  };
}

function deploymentActionBody(flags) {
  const body = { confirm: flags.confirm };
  if (cleanString(flags.cloudflareApiToken)) {
    body.cloudflareApiToken = cleanString(flags.cloudflareApiToken);
  }
  return body;
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
  const wrangler = readJsonc(wranglerConfigPath, {});
  const appSlug =
    config.appSlug ??
    config.appName ??
    wrangler?.vars?.MICROSERVICES_APP_SLUG ??
    wrangler?.name ??
    manifest.id ??
    appId;
  const moduleIds = deploymentModuleIds();

  return {
    templateId: manifest.id ?? config.template ?? appId,
    modules: moduleIds,
    config: {
      ...config,
      appName: appSlug,
      appSlug,
      template: config.template ?? manifest.id ?? appId
    },
    environment,
    projectId: flags.projectId ?? undefined,
    name: flags.name ?? config.business?.name ?? appSlug,
    target: deploymentTarget(flags),
    actor: flags.actor ?? "agent"
  };
}

function deploymentModuleIds() {
  if (Array.isArray(deploymentProfile.modules)) {
    return deploymentProfile.modules.map((id) => cleanString(id)).filter(Boolean);
  }

  if (Array.isArray(manifest.modules?.required)) {
    return manifest.modules.required.map((id) => cleanString(id)).filter(Boolean);
  }

  return (lock.modules ?? []).map((module) => cleanString(module.id)).filter(Boolean);
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

  if (!existsSync(buildOutput)) {
    return fail(
      "BUILD_OUTPUT_MISSING",
      "Cloudflare build output is missing.",
      "Run pnpm build, or rerun deploy preview without --no-build."
    );
  }

  for (const path of [
    "package.json",
    wranglerConfigPath,
    "microservices.config.json",
    "microservices.lock.json",
    "microservices.template.json"
  ]) {
    collectArtifactFile(process.cwd(), path, files);
  }
  if (localRequiresD1) {
    collectArtifactDirectory(process.cwd(), "migrations", files);
  }
  collectArtifactFile(process.cwd(), deployBundleWorker, files);
  collectArtifactDirectory(process.cwd(), buildOutput, files);

  const required = [
    "package.json",
    wranglerConfigPath,
    deployBundleWorker,
    `${buildOutput}/_worker.js`
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
  const migrationNextStep = remoteApiApp
    ? "No app-owned D1 migrations are packaged; this app reads and mutates through the hosted API."
    : "Apply managed D1 migrations through microservices deploy migrate --input deployment.json.";

  return {
    ok: true,
    data: {
      ...input,
      artifact: {
        source: `${appId}-local-build`,
        schemaVersion: "2026-06-14",
        composition: {
          compositionId: checksum,
          template: {
            id: input.templateId,
            name: appDisplayName
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
          deployBundleOutput,
          packageManager: "pnpm",
          createdAt: new Date().toISOString(),
          git: ciMetadata()
        },
        nextSteps: [
          "Provision managed resources through microservices deploy provision --input deployment.json.",
          migrationNextStep,
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
      target: deploymentTarget(flags),
      request: body,
      sideEffects: [
        "run the local build unless --no-build is provided",
        "run a local Wrangler dry-run bundle unless --no-build is provided",
        "package the Cloudflare build artifact",
        "upload the artifact to the control-plane API",
        "create or reuse a control-plane project",
        "prepare a preview deployment record",
        "reserve a managed preview route when the API is configured for it"
      ],
      notDoneLocally: [
        "no local Cloudflare resource creation",
        "no local Wrangler login",
        remoteApiApp ? "no app-owned D1 migration" : "no local remote D1 migration",
        "no local Worker upload"
      ],
      nextSteps: [
        "Run microservices auth login, or set MICROSERVICES_API_KEY.",
        "For BYO Cloudflare OAuth, connect Cloudflare in the portal once API OAuth token storage/resolution is enabled, then pass --target cloudflare --cloudflare-auth oauth --cloudflare-connection-id <id>.",
        "For BYO Cloudflare CI, pass --target cloudflare --cloudflare-auth api-token --cloudflare-account-id <id> and provide MICROSERVICES_API_KEY plus CLOUDFLARE_API_TOKEN on deploy commands.",
        "Run microservices deploy preview --confirm deploy --output deployment.json.",
        "Run microservices deploy provision --input deployment.json --confirm provision.",
        remoteApiApp
          ? "Skip deploy migrate; this app owns no app-local D1 migrations."
          : "Run microservices deploy migrate --input deployment.json --confirm migrate.",
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
  const ciAuth = requireCiApiKey(flags, "preview deploy");
  if (ciAuth) return ciAuth;

  if (!flags.noBuild) {
    const build = runCommand("deploy:build", "vite", ["build"], flags);
    if (!build.ok) return build;
    const bundle = runCommand(
      "deploy:bundle",
      "wrangler",
      ["deploy", "--config", wranglerConfigPath, "--dry-run", "--outdir", ".microservices/deploy-bundle"],
      flags
    );
    if (!bundle.ok) return bundle;
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
      sideEffects: remoteApiApp
        ? [
            "ask the control-plane API to create or reuse deployment records and route/resource metadata",
            "store managed deployment resource ids when the API returns resources for this app"
          ]
        : [
            "ask the control-plane API to create or reuse deployment D1/KV resources",
            "store resource ids on the deployment resource records"
          ],
      notDoneLocally: [
        "no local wrangler d1 create",
        "no local wrangler kv namespace create",
        `no local ${wranglerConfigPath} mutation`
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
  const ciAuth = requireCiApiKey(flags, "deployment provisioning");
  if (ciAuth) return ciAuth;

  return apiRequest(flags, `/deployments/${deploymentId}/provision`, {
    method: "POST",
    body: JSON.stringify({
      ...deploymentActionBody(flags),
      confirm: flags.confirm === "production" ? "production" : flags.confirm
    })
  });
}

function deployMigratePlan(deploymentId, flags) {
  if (remoteApiApp) {
    return {
      ok: true,
      data: {
        status: "skipped",
        apiUrl: resolvedApiSettings(flags).apiUrl,
        deploymentId: deploymentId ?? null,
        action: "deploy-migrate",
        reason: "This remote-API app owns no app-local D1 migrations; platform data lives behind the hosted API.",
        nextSteps: deploymentId
          ? [`Run microservices deploy upload-plan ${deploymentId}.`]
          : ["Run microservices deploy preview --confirm deploy first, then inspect upload readiness."]
      }
    };
  }

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
  if (remoteApiApp) return deployMigratePlan(deploymentId, { ...flags, plan: true });
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
  const ciAuth = requireCiApiKey(flags, "remote migration");
  if (ciAuth) return ciAuth;

  return apiRequest(flags, `/deployments/${deploymentId}/migrate`, {
    method: "POST",
    body: JSON.stringify(deploymentActionBody(flags))
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
  const ciAuth = requireCiApiKey(flags, "Worker upload");
  if (ciAuth) return ciAuth;

  return apiRequest(flags, `/deployments/${deploymentId}/upload`, {
    method: "POST",
    body: JSON.stringify(deploymentActionBody(flags))
  });
}

function normalizeHostname(value) {
  const text = cleanString(value);
  if (!text) return null;
  let hostname = text;
  if (/^https?:\/\//i.test(hostname)) {
    try {
      hostname = new URL(hostname).hostname;
    } catch {
      return null;
    }
  }
  hostname = hostname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!hostname || hostname.includes("/") || hostname.includes(":")) return null;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(hostname)) return null;
  if (!hostname.includes(".")) return null;
  return hostname;
}

function deploymentHostname(flags) {
  return normalizeHostname(flags.hostname ?? flags.url);
}

function deploymentUrlForHostname(hostname) {
  return `https://${hostname}/`;
}

function ensureDomainDeployBundle(flags) {
  const missing = [buildOutput, deployBundleWorker].filter((path) => !existsSync(path));
  if (flags.noBuild) {
    if (!missing.length) {
      return { ok: true, data: { built: false, missing: [] } };
    }
    return fail(
      "DOMAIN_BUNDLE_MISSING",
      "The local Cloudflare build bundle is missing.",
      "Run microservices deploy preview --confirm deploy first, or rerun without --no-build.",
      { missing }
    );
  }

  const build = runCommand("deploy:build", "vite", ["build"], flags);
  if (!build.ok) return build;
  const bundle = runCommand(
    "deploy:bundle",
    "wrangler",
    ["deploy", "--config", wranglerConfigPath, "--dry-run", "--outdir", deployBundleOutput],
    flags
  );
  if (!bundle.ok) return bundle;
  return { ok: true, data: { built: true, missing } };
}

function wranglerDomainArgs(workerName, hostname) {
  return [
    "deploy",
    deployBundleWorker,
    "--config",
    wranglerConfigPath,
    "--name",
    workerName,
    "--domain",
    hostname,
    "--assets",
    buildOutput,
    "--keep-vars"
  ];
}

function deployDomainAddPlan(deploymentId, hostname, flags) {
  return {
    ok: true,
    data: {
      status: "planned",
      apiUrl: resolvedApiSettings(flags).apiUrl,
      deploymentId: deploymentId ?? null,
      hostname,
      url: deploymentUrlForHostname(hostname),
      confirmationRequired: "domain",
      sideEffects: [
        "run local build and Wrangler dry-run bundle so the Worker manifest and static assets stay in sync",
        "run wrangler deploy against the existing deployment Worker name with --domain",
        "upload SvelteKit static assets through Wrangler",
        "record the custom URL on the control-plane deployment via deploy activate"
      ],
      notDoneLocally: [
        "no DNS record mutation through the microservices.sh API",
        "no app-owned D1 migration",
        "no deployment cleanup"
      ],
      nextSteps: deploymentId
        ? [`Run microservices deploy domain add ${deploymentId} --hostname ${hostname} --confirm domain.`]
        : ["Run microservices deploy upload first, then attach a hostname to the returned deployment id."]
    }
  };
}

function isWorkersRouteAuthFailure(result) {
  const output = `${result?.data?.stdout ?? ""}\n${result?.data?.stderr ?? ""}`;
  return output.includes("/workers/routes") && /Authentication error/i.test(output);
}

function domainRouteAuthFailure(result, hostname) {
  return fail(
    "DOMAIN_ROUTE_AUTH_FAILED",
    `Cloudflare rejected the Workers route update for ${hostname}.`,
    "Update CLOUDFLARE_API_TOKEN with zone-level Workers Routes Edit on the hostname's Cloudflare zone, then rerun deploy domain add.",
    {
      command: result.data?.command,
      exitCode: result.data?.exitCode,
      requiredCloudflarePermissions: [
        "Account: Workers Scripts Edit",
        "Zone: Workers Routes Edit",
        "Zone: DNS Write if the custom domain DNS record must be created"
      ]
    }
  );
}

async function deployDomainAdd(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  const hostname = deploymentHostname(flags);
  if (!hostname) {
    return fail(
      "DOMAIN_HOSTNAME_REQUIRED",
      "Domain attachment requires a valid hostname.",
      "Pass --hostname admin-preview.example.com or --domain admin-preview.example.com."
    );
  }
  if (flags.plan) return deployDomainAddPlan(deploymentId, hostname, flags);
  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy upload.");
  }
  if (!["domain", "production-domain"].includes(flags.confirm ?? "")) {
    return fail(
      "DOMAIN_CONFIRMATION_REQUIRED",
      "Attaching a custom domain requires explicit confirmation.",
      `Run microservices deploy domain add ${deploymentId} --hostname ${hostname} --plan, then rerun with --confirm domain.`,
      { confirmationRequired: "domain", productionConfirmationRequired: "production-domain" }
    );
  }

  const status = await deployStatus(deploymentId, flags);
  if (!status.ok) return status;
  const deployment = status.data?.deployment ?? {};
  const workerName = cleanString(deployment.workerName);
  if (!workerName) {
    return fail(
      "WORKER_NAME_MISSING",
      "The deployment does not have a Worker name to attach a custom domain to.",
      "Run microservices deploy upload first, then retry domain attachment.",
      { deploymentId }
    );
  }

  const bundle = ensureDomainDeployBundle(flags);
  if (!bundle.ok) return bundle;

  const wrangler = runCommand("deploy:domain", "wrangler", wranglerDomainArgs(workerName, hostname), flags);
  if (!wrangler.ok) {
    if (isWorkersRouteAuthFailure(wrangler)) return domainRouteAuthFailure(wrangler, hostname);
    return wrangler;
  }

  const url = deploymentUrlForHostname(hostname);
  const activated = await deployActivate(deploymentId, {
    ...flags,
    url,
    mode: flags.mode ?? "dispatch-uploaded"
  });
  if (!activated.ok) return activated;

  return {
    ok: true,
    data: {
      ...activated.data,
      hostname,
      url,
      workerName,
      domain: {
        hostname,
        url,
        workerName,
        command: wrangler.data.command,
        exitCode: wrangler.data.exitCode,
        rebuiltBundle: bundle.data.built
      },
      nextSteps: [
        `Run microservices local smoke --url ${url} --json.`,
        `Run microservices deploy inspect ${deploymentId} --json to verify the route record.`
      ]
    }
  };
}

async function deployStatus(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  const ciAuth = requireCiApiKey(flags, "deployment status");
  if (ciAuth) return ciAuth;
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
  const ciAuth = requireCiApiKey(flags, "upload planning");
  if (ciAuth) return ciAuth;
  return apiRequest(flags, `/deployments/${deploymentId}/upload-plan`);
}

async function deployResources(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  const ciAuth = requireCiApiKey(flags, "deployment resources");
  if (ciAuth) return ciAuth;
  return apiRequest(flags, `/deployments/${deploymentId}/resources`);
}

async function deployResourceUsage(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  const ciAuth = requireCiApiKey(flags, "deployment resource usage");
  if (ciAuth) return ciAuth;
  return apiRequest(flags, `/deployments/${deploymentId}/resources/usage`);
}

function inspectionLimit(flags) {
  return flags.limit ?? 5;
}

function readError(label, response) {
  if (response?.ok) return null;
  return {
    label,
    code: response?.error?.code ?? "UNKNOWN_ERROR",
    message: response?.error?.message ?? `${label} unavailable.`
  };
}

async function deployInspect(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }

  const status = await deployStatus(deploymentId, flags);
  if (!status.ok) return status;

  const inspectFlags = { ...flags, limit: inspectionLimit(flags) };
  const [usage, logs, errors] = await Promise.all([
    deployResourceUsage(deploymentId, flags),
    deployLogs(deploymentId, inspectFlags),
    apiRequest(flags, pathWithQuery(`/deployments/${deploymentId}/errors`, observabilityQuery(inspectFlags)))
  ]);

  return {
    ok: true,
    requestId: status.requestId ?? `local_${Date.now().toString(36)}`,
    data: {
      deployment: status.data.deployment,
      status: status.data,
      usage: usage.ok ? usage.data : null,
      logs: logs.ok ? logs.data.logs ?? [] : [],
      errors: errors.ok ? errors.data.errors ?? [] : [],
      readErrors: [
        readError("resource usage", usage),
        readError("deploy logs", logs),
        readError("runtime errors", errors)
      ].filter(Boolean)
    }
  };
}

async function deployLogs(deploymentId, flags) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  if (!deploymentId) {
    return fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview.");
  }
  const ciAuth = requireCiApiKey(flags, "deployment logs");
  if (ciAuth) return ciAuth;
  return apiRequest(flags, pathWithQuery(`/deployments/${deploymentId}/logs`, logQuery(flags)));
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
  const ciAuth = requireCiApiKey(flags, "deployment activation");
  if (ciAuth) return ciAuth;
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
  const ciAuth = requireCiApiKey(flags, "deployment disable");
  if (ciAuth) return ciAuth;
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
  const ciAuth = requireCiApiKey(flags, "resource cleanup");
  if (ciAuth) return ciAuth;

  return apiRequest(flags, `/deployments/${deploymentId}/cleanup`, {
    method: "POST",
    body: JSON.stringify(deploymentActionBody(flags))
  });
}

async function deployDoctor(flags, deploymentId = null) {
  const resolved = deploymentIdArg(deploymentId, flags);
  if (!resolved.ok) return resolved;
  deploymentId = resolved.data;

  const local = checkResponse();
  const settings = resolvedApiSettings(flags);
  const target = deploymentTarget(flags);
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
    },
    {
      id: "deploy-target",
      status: "pass",
      message:
        target.provider === "cloudflare"
          ? `BYO Cloudflare target selected with ${target.auth} auth.`
          : "Managed microservices.sh Cloudflare target selected."
    }
  ];

  if (target.provider === "cloudflare") {
    checks.push({
      id: "cloudflare-account",
      status: target.accountId ? "pass" : "warn",
      message: target.accountId
        ? `Cloudflare account id is configured: ${target.accountId}.`
        : "Cloudflare target should include --cloudflare-account-id or CLOUDFLARE_ACCOUNT_ID before provisioning."
    });
    checks.push(cloudflareCredentialCheck(target, flags));
  }

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

function formatDomain(result) {
  const deployment = result.deployment ?? {};
  const domain = result.domain ?? {};
  return `Deployment domain attached
Deployment: ${deployment.id ?? "unknown"}
Status: ${deployment.status ?? "unknown"}
Worker: ${domain.workerName ?? deployment.workerName ?? "unknown"}
Hostname: ${domain.hostname ?? result.hostname ?? "unknown"}
URL: ${domain.url ?? result.url ?? deployment.previewUrl ?? "unknown"}
Next:
${(result.nextSteps ?? []).map((step) => `- ${step}`).join("\n") || "- Run deploy inspect to verify the deployment route."}
`;
}

function formatResources(result) {
  return `Deployment: ${result.deployment.id}
Resources:
${result.resources.length ? result.resources.map((item) => `- ${item.resourceType}/${item.binding}: ${item.status} ${item.name}${item.externalId ? ` (${item.externalId})` : ""}`).join("\n") : "none"}
`;
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}

function formatMetricPair(metric, unit = "") {
  if (!isRecord(metric)) return "unknown";
  const published = metric.published ?? "unknown";
  const uploaded = metric.uploaded ?? "unknown";
  return `${published}${unit} published / ${uploaded}${unit} uploaded`;
}

function formatResourceIdentity(resource) {
  const externalId = resource.externalId ? ` (${resource.externalId})` : "";
  return `${resource.resourceType}/${resource.binding}: ${resource.status} ${resource.name}${externalId}`;
}

function formatResourceUsageLine(resource) {
  const base = formatResourceIdentity(resource);
  const usage = isRecord(resource.usage) ? resource.usage : null;
  if (resource.resourceType === "d1" && usage) {
    return `- ${base}
  D1: ${formatBytes(usage.fileSizeBytes)}, tables=${usage.tableCount ?? "unknown"}, replication=${usage.readReplicationMode ?? "unknown"}`;
  }
  if (resource.resourceType === "r2" && usage && isRecord(usage.bucket)) {
    return `- ${base}
  R2: storage=${usage.bucket.storageClass ?? "unknown"}, location=${usage.bucket.location ?? "unknown"}, metrics=${usage.accountMetricsScope ?? "unknown"}`;
  }
  const diagnostics = isRecord(resource.diagnostics) ? resource.diagnostics : {};
  return `- ${base}
  ${diagnostics.reason ?? "status-only"}: ${diagnostics.message ?? "No Cloudflare usage details returned."}`;
}

function formatCloudflareUsageLine(cloudflare) {
  if (cloudflare.available) {
    return `Cloudflare: configured (${cloudflare.accountId ?? "unknown account"})`;
  }
  const missing = Array.isArray(cloudflare.missing) ? cloudflare.missing.join(", ") : "missing credentials";
  return `Cloudflare: not configured (${missing})`;
}

function formatR2AccountMetrics(metrics) {
  if (!isRecord(metrics) || !isRecord(metrics.totals)) return "";
  const totals = metrics.totals;
  return `\nR2 account metrics:
- Objects: ${formatMetricPair(totals.objects)}
- Payload: ${formatMetricPair(totals.payloadSizeBytes, " bytes")}
- Metadata: ${formatMetricPair(totals.metadataSizeBytes, " bytes")}
`;
}

function formatR2MetricsDiagnostic(diagnostics) {
  if (!isRecord(diagnostics)) return "";
  return `\nR2 account metrics unavailable: ${diagnostics.message ?? diagnostics.reason}\n`;
}

function formatResourceUsage(result) {
  const resources = Array.isArray(result.resources) ? result.resources : [];
  const cloudflare = isRecord(result.cloudflare) ? result.cloudflare : {};
  const r2Metrics = formatR2AccountMetrics(result.r2AccountMetrics);
  const r2MetricsDiagnostic = formatR2MetricsDiagnostic(result.r2MetricsDiagnostics);

  return `Deployment: ${result.deployment.id}
${formatCloudflareUsageLine(cloudflare)}
Resources:
${resources.length ? resources.map(formatResourceUsageLine).join("\n") : "none"}
${r2Metrics}${r2MetricsDiagnostic}Next:
${(result.nextSteps ?? []).map((step) => `- ${step}`).join("\n")}
`;
}

function formatResourceUsageSummary(result) {
  if (!isRecord(result)) return "Resources: unavailable\n";
  const resources = Array.isArray(result.resources) ? result.resources : [];
  const cloudflare = isRecord(result.cloudflare) ? result.cloudflare : {};
  const r2Metrics = formatR2AccountMetrics(result.r2AccountMetrics);
  const r2MetricsDiagnostic = formatR2MetricsDiagnostic(result.r2MetricsDiagnostics);
  return `${formatCloudflareUsageLine(cloudflare)}
Resources:
${resources.length ? resources.map(formatResourceUsageLine).join("\n") : "none"}
${r2Metrics}${r2MetricsDiagnostic}`;
}

function formatLogSummary(logs) {
  const items = Array.isArray(logs) ? logs : [];
  if (!items.length) return "none";
  return items.map((log) => `- ${isoTime(log.createdAt)} ${String(log.level ?? "info").toUpperCase()} ${log.message}`).join("\n");
}

function formatErrorSummary(errors) {
  const items = Array.isArray(errors) ? errors : [];
  if (!items.length) return "none";
  return items
    .map((error) => {
      const parts = [
        `${error.count ?? 1}x`,
        String(error.level ?? "error").toUpperCase(),
        error.eventType ?? "runtime.exception",
        error.route ? `route=${error.route}` : null,
        error.lastSeen ? `last=${isoTime(error.lastSeen)}` : null
      ].filter(Boolean);
      return `- ${parts.join(" ")}\n  ${error.message}`;
    })
    .join("\n");
}

function formatUnavailableReads(readErrors) {
  const items = Array.isArray(readErrors) ? readErrors : [];
  if (!items.length) return "";
  return `\nUnavailable:
${items.map((item) => `- ${item.label}: ${item.message}`).join("\n")}
`;
}

function formatInspection(result) {
  const deployment = result.deployment ?? {};
  const status = result.status ?? {};
  return `Deployment: ${deployment.id ?? "unknown"}
Status: ${deployment.status ?? "unknown"}
Mode: ${deployment.mode ?? "unknown"}
Preview URL: ${deployment.previewUrl ?? "not provisioned yet"}
Artifact: ${status.artifact?.checksum ?? "unknown"}

${formatResourceUsageSummary(result.usage)}
Latest deploy logs:
${formatLogSummary(result.logs)}

Runtime error groups:
${formatErrorSummary(result.errors)}${formatUnavailableReads(result.readErrors)}
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
  const logs = Array.isArray(result.logs) ? result.logs : [];
  if (!logs.length) return "No deployment logs found.\n";
  return `${logs.map((log) => `${log.level.toUpperCase()} ${log.message}`).join("\n")}\n`;
}

function isoTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value ?? "");
}

function formatObservabilityEvents(result) {
  const events = Array.isArray(result.events) ? result.events : [];
  if (!events.length) return "No observability events found.\n";
  return `${events
    .map((event) => {
      const parts = [
        isoTime(event.createdAt),
        String(event.level ?? "info").toUpperCase(),
        event.source ?? "runtime",
        event.eventType ?? "event",
        event.route ? `route=${event.route}` : null,
        event.statusCode ? `status=${event.statusCode}` : null
      ].filter(Boolean);
      return `${parts.join(" ")}\n  ${event.message}`;
    })
    .join("\n")}\n`;
}

function formatErrorGroups(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  if (!errors.length) return "No error groups found.\n";
  return `${errors
    .map((error) => {
      const parts = [
        `${error.count}x`,
        String(error.level ?? "error").toUpperCase(),
        error.eventType ?? "runtime.exception",
        error.route ? `route=${error.route}` : null,
        `last=${isoTime(error.lastSeen)}`
      ].filter(Boolean);
      return `${parts.join(" ")}\n  ${error.message}\n  fingerprint: ${error.fingerprint ?? error.key}`;
    })
    .join("\n")}\n`;
}

function formatObservabilityToken(result) {
  return `Observability token created
Name: ${result.name}
Prefix: ${result.prefix}
Scopes: ${(result.scopes ?? []).join(", ")}

Set this secret in the app environment:
MICROSERVICES_OBSERVABILITY_TOKEN=${result.secret}
`;
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
  return `${appId} microservices commands:
  microservices modules list                     # list installed modules
  microservices add <id[@version]>               # vendor a module into this app
  microservices remove <id>                      # remove a vendored module from this app
  microservices install                          # vendor modules from microservices.config.json (+ their deps)
  microservices docs <id>                        # show a module's agent docs
  microservices memory search <query>            # search approved Code Memory capsules
  microservices memory get <capsule-id-or-slug>  # inspect an approved Logic Capsule
  microservices setup [id] [--input setup.json]  # guided template/module setup
  microservices upgrade <id[@version]> [--to x] [--plan]  # upgrade or downgrade a module
  microservices check                            # verify the app against its contract
  microservices local dev [--host <h>] [--port <p>]   # run the app locally
  microservices local setup                      # verify local readiness
  microservices local seed                       # run scripts/seed.mjs to populate local data
  microservices auth login                       # authenticate the CLI
  microservices deploy run [--plan] [--confirm deploy]   # build + managed deploy workflow
  microservices deploy domain add <id> --hostname <host> # attach a custom preview domain
  microservices deploy inspect [deployment-id]   # status, resources, logs, and errors

  Common flags: [--json] [--api-url <url>] [--api-key <key>]
  More: "microservices deploy --help-all" for granular deploy/local/auth steps and BYO-Cloudflare flags.
`;
}

function usageAll() {
  return `${appId} microservices commands (full):
  Global flags: [--json] [--api-url <url>] [--api-key <key>] [--input deployment.json] [--deployment-id <id>] [--output result.json]
  Deploy target flags: [--target managed|cloudflare] [--cloudflare-config '<json>']
    BYO-Cloudflare config fields (or individual --cloudflare-* flags):
      {"auth":"oauth|api-token","accountId":"...","zoneId":"...","previewBaseDomain":"...","connectionId":"...","apiToken":"..."}
  microservices modules list [--json]
  microservices add <id[@version]> [--version x] [--json]
  microservices remove <id> [--plan] [--confirm overwrite] [--json]
  microservices docs <id> [--json]
  microservices memory source list [--limit 50] [--json]
  microservices memory github status [--json]
  microservices memory search <query> [--limit 25] [--json]
  microservices memory get <capsule-id-or-slug> [--json]
  microservices setup [id] [--input setup.json] [--plan] [--json]
  microservices upgrade <id[@version]> [--to x] [--plan] [--json]
  microservices check [--json]
  microservices local setup [--json]
  microservices local verify [--json]
  microservices local migrate [--json]${remoteApiApp ? "  # skipped for remote-API apps" : ""}
  microservices local dev [--host ${localDevHost}] [--port ${localDevPort}]
  microservices local seed [--json]                  # run scripts/seed.mjs to populate local data
  microservices local smoke [--url http://${localDevHost}:${localDevPort}] [--json]
  microservices auth login [--api-url https://api.microservices.sh] [--json]
  microservices auth login --api-key <key> [--api-url https://api.microservices.sh] [--json]
  microservices auth status [--json]
  microservices auth logout [--json]
  microservices deploy run [--plan] [--confirm deploy] [--ci] [--timeout 10m] [--json]   # one-command managed deploy (waits for live when configured)
  microservices deploy doctor [deployment-id] [--json]
  microservices deploy preview [--plan] [--confirm deploy] [--name <name>] [--project-id <id>] [--ci] [--wait] [--timeout 10m] [--output deployment.json] [--json]
  microservices deploy provision [deployment-id] [--input deployment.json] [--plan] --confirm provision [--json]
  microservices deploy migrate [deployment-id] [--input deployment.json] [--plan] --confirm migrate [--json]${remoteApiApp ? "  # skipped for remote-API apps" : ""}
  microservices deploy upload-plan [deployment-id] [--input deployment.json] [--json]
  microservices deploy upload [deployment-id] [--input deployment.json] [--plan] --confirm upload [--json]
  microservices deploy domain add [deployment-id] --hostname <host> [--plan] --confirm domain [--json]
  microservices deploy inspect [deployment-id] [--input deployment.json] [--search "..."] [--level info|warn|error] [--since 24h] [--limit 5] [--json]
  microservices deploy status [deployment-id] [--input deployment.json] [--json]
  microservices deploy resources [deployment-id] [--input deployment.json] [--json]
  microservices deploy usage [deployment-id] [--input deployment.json] [--json]
  microservices deploy logs [deployment-id] [--input deployment.json] [--search "..."] [--level info|warn|error] [--since 24h] [--json]
  microservices logs <deployment-id> [--search "..."] [--level info|warn|error] [--since 24h] [--json]
  microservices observe logs <deployment-id> [--search "..."] [--level debug|info|warn|error|fatal] [--source runtime|healthcheck|cloudflare_tail] [--since 24h] [--json]
  microservices observe errors <deployment-id> [--search "..."] [--since 7d] [--json]
  microservices observe token create [--name "Runtime reporter"] [--json]
  microservices errors <deployment-id> [--search "..."] [--since 7d] [--json]
  microservices deploy follow [deployment-id] [--input deployment.json] [--timeout 10m] [--json]
  microservices deploy activate [deployment-id] [--input deployment.json] --url <managed-url> [--mode dispatch-uploaded] [--json]
  microservices deploy disable [deployment-id] [--input deployment.json] --confirm disable [--json]
  microservices deploy cleanup [deployment-id] [--input deployment.json] [--plan] --confirm cleanup [--json]
`;
}

function memoryLimit(flags, fallback = 25) {
  if (flags.limit === null || flags.limit === undefined) return fallback;
  const limit = Number(flags.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  return limit;
}

function formatMemorySource(source) {
  const paths = Array.isArray(source.allowedPaths) && source.allowedPaths.length
    ? ` paths=${source.allowedPaths.join(",")}`
    : "";
  return `${source.id} ${source.provider}:${source.repoOwner}/${source.repoName} ${source.repoVisibility ?? "unknown"} ${source.scanStatus ?? "not_scanned"}${paths}`;
}

function formatMemorySources(result) {
  const sources = Array.isArray(result.sources) ? result.sources : [];
  if (!sources.length) return "No Trusted Sources found.\n";
  return `${sources.map(formatMemorySource).join("\n")}\n`;
}

function formatMemoryCapsule(capsule) {
  const provenance = capsule.provenance ?? {};
  const repo = provenance.repoUrl ?? [provenance.repoOwner, provenance.repoName].filter(Boolean).join("/");
  return `${capsule.slug ?? capsule.id}: ${capsule.name}
  ${capsule.purpose}
  Source: ${repo || "unknown"}${provenance.path ? `/${provenance.path}` : ""}${provenance.ref ? `@${provenance.ref}` : ""}
  Mode: ${capsule.reuseMode ?? "adapt"}  Status: ${capsule.approvalStatus ?? "approved"}  Visibility: ${capsule.visibility ?? "workspace_private"}`;
}

function formatMemoryCapsules(result) {
  const capsules = Array.isArray(result.capsules) ? result.capsules : [];
  if (!capsules.length) return "No Logic Capsules found.\n";
  return `${capsules.map(formatMemoryCapsule).join("\n\n")}\n`;
}

function formatLogicCapsule(result) {
  const capsule = result.capsule ?? result;
  const lines = [
    formatMemoryCapsule(capsule),
    capsule.files?.length ? `Files:\n${capsule.files.map((item) => `- ${item}`).join("\n")}` : null,
    capsule.dependencies?.length ? `Dependencies: ${capsule.dependencies.join(", ")}` : null,
    capsule.requiredEnv?.length ? `Required env: ${capsule.requiredEnv.join(", ")}` : null,
    capsule.tests?.length ? `Tests:\n${capsule.tests.map((item) => `- ${item}`).join("\n")}` : null,
    capsule.constraints?.length ? `Constraints:\n${capsule.constraints.map((item) => `- ${item}`).join("\n")}` : null,
    capsule.doNotUseFor?.length ? `Do not use for:\n${capsule.doNotUseFor.map((item) => `- ${item}`).join("\n")}` : null,
    capsule.usageNotes ? `Usage notes:\n${capsule.usageNotes}` : null
  ].filter(Boolean);
  return `${lines.join("\n")}\n`;
}

function formatMemoryGithubStatus(result) {
  const app = result.githubApp ?? {};
  const installations = Array.isArray(result.installations) ? result.installations : [];
  return `GitHub App: ${app.configured ? "configured" : "not configured"}
Installations: ${installations.length ? installations.map((item) => item.accountLogin ?? item.installationId).join(", ") : "none"}
`;
}

function readOnlyMemoryResponse(action) {
  return fail(
    "MEMORY_COMMAND_READ_ONLY",
    `Generated app memory command "${action}" is read-only here.`,
    "Use the hosted portal, MCP tools, or root microservices CLI for Trusted Source mutations and approvals.",
    { action }
  );
}

async function handleMemoryCommand(args, flags) {
  const [, action = "source", value, extra] = args;
  const limit = memoryLimit(flags, action === "source" || action === "sources" || action === "trusted-sources" ? 50 : 25);
  if (limit === null) {
    emit(fail("INVALID_MEMORY_LIMIT", "--limit must be an integer between 1 and 100.", "Pass --limit 25 or omit it."), null, flags);
    return;
  }

  if (action === "source" || action === "sources" || action === "trusted-sources") {
    if (!value || value === "list") {
      emit(await apiRequest(flags, pathWithQuery("/memory/sources", { limit: String(limit) })), formatMemorySources, flags);
      return;
    }
    emit(readOnlyMemoryResponse(`source ${value}`), null, flags);
    return;
  }

  if (action === "github") {
    if (!value || value === "status" || value === "list") {
      emit(await apiRequest(flags, "/memory/github/status"), formatMemoryGithubStatus, flags);
      return;
    }
    emit(readOnlyMemoryResponse(`github ${value}`), null, flags);
    return;
  }

  if (action === "search" || action === "capsules") {
    const query = action === "search" ? value ?? flags.search : flags.search ?? value;
    emit(await apiRequest(flags, pathWithQuery("/memory/capsules", { q: query, limit: String(limit) })), formatMemoryCapsules, flags);
    return;
  }

  if (action === "get" || (action === "capsule" && value === "get")) {
    const id = action === "get" ? value : extra;
    if (!id) {
      emit(fail("MEMORY_CAPSULE_ID_REQUIRED", "Missing Logic Capsule id or slug.", "Run `microservices memory get <capsule-id-or-slug>`."), null, flags);
      return;
    }
    emit(await apiRequest(flags, `/memory/capsules/${encodeURIComponent(id)}`), formatLogicCapsule, flags);
    return;
  }

  emit(
    fail(
      "UNKNOWN_MEMORY_COMMAND",
      `Unknown memory command: ${action}.`,
      "Use `memory source list`, `memory github status`, `memory search`, or `memory get`.",
      { command: action }
    ),
    null,
    flags
  );
}

async function main() {
  const { args, flags, error } = parseArgs(process.argv.slice(2));
  const [resource, action, value] = args;

  if (error) {
    emit(error, null, flags);
    return;
  }

  if (flags.helpAll || resource === "help-all") {
    process.stdout.write(usageAll());
    return;
  }

  if (!resource || resource === "help" || resource === "--help" || resource === "-h") {
    process.stdout.write(usage());
    return;
  }

  telemetryNotice(flags.json);

  if (resource === "deploy") {
    const deployFlagError = validateDeployFlags(flags);
    if (deployFlagError) {
      emit(deployFlagError, null, flags);
      return;
    }
  }

  if (resource === "modules" && action === "list") {
    emit(
      { ok: true, data: lock.modules ?? [] },
      (modules) => `${modules.map((module) => `${module.id}@${module.version}`).join("\n")}\n`,
      flags
    );
  } else if (resource === "add" && flags.plan) {
    // Read-only: report what would be vendored. No telemetry (not an install).
    let response;
    try {
      response = await addModule(action, { plan: true, version: flags.version });
    } catch (error) {
      response = fail(
        "MODULE_ADD_PLAN_FAILED",
        `Could not plan add${action ? `: ${action}` : ""}.`,
        "Review the command output and retry.",
        { moduleId: action ?? null, reason: error?.message ?? String(error) }
      );
    }
    emit(response, (data) => `Plan: would vendor ${data.id}@${data.version ?? "?"} to ${data.wouldVendorTo}\n  dependency: ${data.dependency}\n`, flags);
  } else if (resource === "add") {
    const startedAt = Date.now();
    await track("module_install_started", workspaceTelemetryProps(flags, { moduleId: action ?? null }));
    let response;
    try {
      response = await addModule(action, { version: flags.version });
    } catch (error) {
      response = fail(
        "MODULE_INSTALL_FAILED",
        `Module install failed${action ? `: ${action}` : ""}.`,
        "Review the command output and retry.",
        { moduleId: action ?? null, reason: error?.message ?? String(error) }
      );
    }
    if (response.ok) {
      recordModuleIntent(`${response.data.id}@${response.data.version}`);
    }
    await trackResponse(
      "module_install_completed",
      "module_install_failed",
      response,
      workspaceTelemetryProps(flags, { moduleId: action ?? null, durationMs: durationMs(startedAt) })
    );
    emit(response, (data) => `Vendored ${data.id} to ${data.vendoredTo}.\n`, flags);
  } else if (resource === "remove") {
    const startedAt = Date.now();
    await track("module_remove_started", workspaceTelemetryProps(flags, { moduleId: action ?? null }));
    let response;
    try {
      response = await removeModule(action, { plan: flags.plan, confirm: flags.confirm });
    } catch (error) {
      response = fail(
        "MODULE_REMOVE_FAILED",
        `Module remove failed${action ? `: ${action}` : ""}.`,
        "Review the command output and retry.",
        { moduleId: action ?? null, reason: error?.message ?? String(error) }
      );
    }
    if (response.ok && !response.data.plan && response.data.removed) {
      recordModuleIntent(response.data.removed, { removed: true });
    }
    await trackResponse(
      "module_remove_completed",
      "module_remove_failed",
      response,
      workspaceTelemetryProps(flags, { moduleId: action ?? null, durationMs: durationMs(startedAt) })
    );
    emit(
      response,
      (data) => (data.plan ? `Plan: would remove ${data.wouldRemoveDir}\n` : `Removed ${data.removedDir}.\n`),
      flags
    );
  } else if (resource === "install") {
    const startedAt = Date.now();
    await track("modules_install_started", workspaceTelemetryProps(flags, {}));
    let response;
    try {
      response = await installModules(flags);
    } catch (error) {
      response = fail(
        "INSTALL_FAILED",
        "Install failed.",
        "Review the command output and retry.",
        { reason: error?.message ?? String(error) }
      );
    }
    await trackResponse(
      "modules_install_completed",
      "modules_install_failed",
      response,
      workspaceTelemetryProps(flags, { durationMs: durationMs(startedAt) })
    );
    emit(
      response,
      (data) => `${data.installed.map((module) => `${module.status} ${module.id}`).join("\n") || "Nothing to install."}\n`,
      flags
    );
  } else if (resource === "docs") {
    const moduleDocs = [];
    if (action) {
      for (const source of [`modules/${action}/README.agent.md`, `modules/${action}/README.md`]) {
        if (existsSync(source)) moduleDocs.push(readFileSync(source, "utf8").trim());
      }
      if (existsSync(`modules/${action}/module.json`)) {
        moduleDocs.push(`See modules/${action}/module.json for the full connection contract (requires, events, exposes).`);
      }
    }
    const content = action
      ? (moduleDocs.length
          ? moduleDocs.join("\n\n")
          : `No docs found for module "${action}". Run "microservices modules list" to see installed modules.`)
      : `Usage: microservices docs <module-id>. Run "microservices modules list" to list installed modules.`;
    emit({ ok: true, data: { id: action ?? null, content } }, (data) => `${data.content}\n`, flags);
  } else if (resource === "memory" || resource === "code-memory") {
    await handleMemoryCommand(args, flags);
  } else if (resource === "setup") {
    const startedAt = Date.now();
    const response = await setupResponse(action, flags);
    await trackResponse(
      "interactive_setup_completed",
      "interactive_setup_failed",
      response,
      workspaceTelemetryProps(flags, {
        target: action ?? manifest.id ?? null,
        plan: flags.plan,
        durationMs: durationMs(startedAt)
      })
    );
    emit(response, formatSetupResult, flags);
  } else if (resource === "upgrade") {
    const response = flags.plan ? moduleUpgradePlan(action, flags) : applyModuleUpgrade(action, flags);
    emit(
      response,
      (data) => {
        const moduleId = data.module?.id ?? data.id;
        const currentVersion = data.module?.currentVersion ?? data.currentVersion;
        const targetVersion = data.module?.targetVersion ?? data.targetVersion;
        return `${moduleId}: ${currentVersion} -> ${targetVersion} (${data.action})\n`;
      },
      flags
    );
  } else if (resource === "check") {
    const response = checkResponse();
    await track(
      response.ok ? "check_passed" : "check_failed",
      workspaceTelemetryProps(flags, {
        status: response.ok ? "pass" : "fail",
        errorCode: response.ok ? null : response.error?.code ?? "CHECK_FAILED"
      })
    );
    emit(response, (data) => `Template checks: ${data.checks.every((check) => check.status === "pass") ? "pass" : "fail"}\n`, flags);
  } else if (resource === "local" && action === "setup") {
    const startedAt = Date.now();
    const response = localSetup(flags);
    await trackResponse(
      "workspace_setup_completed",
      "workspace_setup_failed",
      response,
      workspaceTelemetryProps(flags, { kind: "local_setup", durationMs: durationMs(startedAt) })
    );
    emit(response, (data) => `Local setup ${data.status}.\n`, flags);
  } else if (resource === "local" && action === "verify") {
    emit(localSetup(flags), (data) => `Local verification ${data.status}.\n`, flags);
  } else if (resource === "local" && action === "migrate") {
    emit(localMigrate(flags), (data) => `Local migration ${data.skipped ? "skipped" : `exited ${data.exitCode}`}.\n`, flags);
  } else if (resource === "local" && action === "dev") {
    const startedAt = Date.now();
    await track("workspace_start_attempted", workspaceTelemetryProps(flags, { kind: "local_dev" }));
    const response = localDev(flags);
    await trackResponse(
      "workspace_start_completed",
      "workspace_start_failed",
      response,
      workspaceTelemetryProps(flags, { kind: "local_dev", durationMs: durationMs(startedAt) })
    );
    emit(response, (data) => `Local dev exited ${data.exitCode}.\n`, flags);
  } else if (resource === "local" && action === "smoke") {
    const url = flags.url || value || `http://${localDevHost}:${localDevPort}`;
    const startedAt = Date.now();
    const response = runCommand("local:smoke", "node", ["scripts/smoke-http.mjs", url], flags);
    await trackResponse(
      "workspace_smoke_completed",
      "workspace_smoke_failed",
      response,
      workspaceTelemetryProps(flags, { kind: "local_smoke", durationMs: durationMs(startedAt) })
    );
    emit(response, (data) => `Local smoke exited ${data.exitCode}.\n`, flags);
  } else if (resource === "local" && action === "seed") {
    emit(localSeed(flags), (data) => `Local seed exited ${data.exitCode}.\n`, flags);
  } else if (resource === "auth" && action === "login") {
    const startedAt = Date.now();
    const method = flags.apiKey ? "api_key" : "device";
    await track("auth_login_started", workspaceTelemetryProps(flags, { method }));
    const response = await authLogin(flags);
    await trackResponse(
      "auth_login_completed",
      "auth_login_failed",
      response,
      workspaceTelemetryProps(flags, { method, durationMs: durationMs(startedAt) })
    );
    emit(response, (data) => `Logged in for ${data.apiUrl}.\nConfig: ${data.configPath}\n`, flags);
  } else if (resource === "auth" && action === "status") {
    emit(await authStatus(flags), (data) => `API: ${data.apiUrl}\nToken: ${data.configured ? data.token : "not configured"}\nServer auth: ${data.server ? "authenticated" : "unknown"}\nConfig: ${data.configPath}\n`, flags);
  } else if (resource === "auth" && action === "logout") {
    removeCliConfig();
    emit({ ok: true, data: { configPath: DEFAULT_CONFIG_PATH } }, (data) => `Logged out. Removed ${data.configPath}\n`, flags);
  } else if (resource === "deploy" && (action === "run" || action === "up")) {
    // One-command managed deploy: prepares the deployment and waits for the
    // control plane to provision/migrate/upload/activate it to "live". The
    // granular steps (provision/migrate/upload/activate) remain available for
    // the BYO-Cloudflare / manual path — see `microservices deploy --help-all`.
    emit(await deployPreview({ ...flags, wait: true }), formatPreparedDeployment, flags);
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
  } else if (resource === "deploy" && (action === "domain" || action === "domains")) {
    const domainAction = value ?? "add";
    if (domainAction !== "add") {
      emit(fail("UNKNOWN_DOMAIN_ACTION", "Unknown deploy domain action.", "Use microservices deploy domain add <deployment-id> --hostname <host>."), null, flags);
      return;
    }
    emit(await deployDomainAdd(args[3] ?? null, flags), (data) => data.domain ? formatDomain(data) : `Domain plan: ${data.status}\n`, flags);
  } else if (resource === "deploy" && (action === "inspect" || action === "debug")) {
    emit(await deployInspect(value, flags), formatInspection, flags);
  } else if (resource === "deploy" && action === "status") {
    emit(await deployStatus(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "resources") {
    emit(await deployResources(value, flags), formatResources, flags);
  } else if (resource === "deploy" && (action === "usage" || action === "resource-usage" || action === "resources-usage")) {
    emit(await deployResourceUsage(value, flags), formatResourceUsage, flags);
  } else if ((resource === "deploy" && action === "logs") || resource === "logs") {
    const deploymentId = resource === "logs" ? action : value;
    emit(await deployLogs(deploymentId, flags), formatLogs, flags);
  } else if (resource === "observe" && (action === "logs" || action === "events")) {
    if (!value) {
      emit(fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview."), null, flags);
      return;
    }
    emit(await apiRequest(flags, pathWithQuery(`/deployments/${value}/observability/events`, observabilityQuery(flags))), formatObservabilityEvents, flags);
  } else if (resource === "observe" && (action === "token" || action === "tokens")) {
    const tokenAction = value ?? "create";
    if (tokenAction !== "create") {
      emit(fail("UNKNOWN_OBSERVE_TOKEN_ACTION", "Unknown observe token action.", "Use microservices observe token create."), null, flags);
      return;
    }
    emit(
      await apiRequest(flags, "/observability/tokens", {
        method: "POST",
        body: JSON.stringify({ name: flags.name ?? "Runtime observability reporter" })
      }),
      formatObservabilityToken,
      flags
    );
  } else if ((resource === "observe" && action === "errors") || resource === "errors") {
    const deploymentId = resource === "errors" ? action : value;
    if (!deploymentId) {
      emit(fail("DEPLOYMENT_ID_REQUIRED", "Missing deployment id.", "Pass the deployment id returned by deploy preview."), null, flags);
      return;
    }
    emit(await apiRequest(flags, pathWithQuery(`/deployments/${deploymentId}/errors`, observabilityQuery(flags))), formatErrorGroups, flags);
  } else if (resource === "deploy" && action === "follow") {
    emit(await deployFollow(value, flags), formatFollow, flags);
  } else if (resource === "deploy" && action === "activate") {
    emit(await deployActivate(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "disable") {
    emit(await deployDisable(value, flags), formatStatus, flags);
  } else if (resource === "deploy" && action === "cleanup") {
    emit(await deployCleanup(value, flags), (data) => data.cleanup ? formatCleanup(data) : `Cleanup plan: ${data.status}\n`, flags);
  } else {
    process.stdout.write(usage());
    process.exitCode = 1;
  }
}

main().catch((error) => {
  emit(fail("CLI_FAILED", error.message, "Review the command arguments and retry."), null, { json: process.argv.includes("--json") });
});
