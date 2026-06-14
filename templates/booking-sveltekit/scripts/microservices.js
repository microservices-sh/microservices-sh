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
import { tmpdir } from "node:os";
import { delimiter, join, relative, resolve } from "node:path";

const SOURCE_REPO = "microservices-sh/microservices-sh";
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

function writeJson(path, value) {
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

  const manifest = files
    .map((file) => `${relative(root, file)}:${createHash("sha256").update(readFileSync(file)).digest("hex")}`)
    .sort()
    .join("\n");
  return `sha256-${createHash("sha256").update(manifest).digest("hex")}`;
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
    writeJson(lockPath, lockData);

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

function parseArgs(argv) {
  const args = [];
  const flags = {
    json: false,
    dryRun: false,
    plan: false,
    confirm: null,
    url: null,
    d1Id: null,
    d1Name: null,
    kvId: null,
    rateLimitKvId: null,
    workerName: null,
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
    } else if (value === "--plan") {
      flags.plan = true;
    } else if (value === "--confirm") {
      flags.confirm = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--url") {
      flags.url = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--d1-id") {
      flags.d1Id = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--d1-name") {
      flags.d1Name = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--kv-id") {
      flags.kvId = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--rate-limit-kv-id") {
      flags.rateLimitKvId = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--worker-name") {
      flags.workerName = argv[index + 1] ?? "";
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

function hasPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || value.startsWith("REPLACE_WITH");
}

function loadWranglerConfig() {
  try {
    return { ok: true, config: readJsonc("wrangler.jsonc", null) };
  } catch (error) {
    return fail("WRANGLER_CONFIG_INVALID", "wrangler.jsonc is not valid JSONC.", error.message);
  }
}

function d1Target(config) {
  return (config?.d1_databases ?? []).find((database) => database?.binding === "DB") ?? null;
}

function kvTarget(config) {
  return (config?.kv_namespaces ?? []).find((namespace) => namespace?.binding === "CACHE_KV") ?? null;
}

function kvTargets(config) {
  return (config?.kv_namespaces ?? []).filter((namespace) => namespace && typeof namespace.binding === "string");
}

// Map a binding name to the id provided via flags (extend as more KV bindings
// are added by modules; gateway adds RATE_LIMIT_KV).
function kvIdForBinding(binding, flags) {
  if (binding === "CACHE_KV") return flags.kvId;
  if (binding === "RATE_LIMIT_KV") return flags.rateLimitKvId;
  return null;
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
            remediation: "Restore the missing template files before running local or preview commands.",
            details: { failed }
          }
        }
      : {})
  };
}

function previewReadinessResponse() {
  const loaded = loadWranglerConfig();
  if (!loaded.ok) return loaded;
  const config = loaded.config;
  if (!config) {
    return fail("WRANGLER_CONFIG_MISSING", "wrangler.jsonc was not found.", "Restore wrangler.jsonc before preview deploy.");
  }

  const d1 = d1Target(config);
  const kv = kvTarget(config);
  const allKv = kvTargets(config);
  const checks = [
    {
      id: "worker-name",
      status: config.name && config.name !== "booking-sveltekit" ? "pass" : "warn",
      message: config.name ? `Worker name is ${config.name}.` : "Worker name is missing."
    },
    {
      id: "d1-binding",
      status: d1 ? "pass" : "fail",
      message: d1 ? "D1 binding DB exists." : "D1 binding DB is missing."
    },
    {
      id: "d1-id",
      status: d1 && !hasPlaceholder(d1.database_id) ? "pass" : "fail",
      message: d1 && !hasPlaceholder(d1.database_id) ? "D1 database id is set." : "D1 database id is still a placeholder."
    },
    {
      id: "kv-bindings",
      status: allKv.length ? "pass" : "fail",
      message: allKv.length ? `KV bindings present: ${allKv.map((namespace) => namespace.binding).join(", ")}.` : "No KV bindings found."
    },
    // One id check per KV namespace so every binding (e.g. RATE_LIMIT_KV) is verified.
    ...allKv.map((namespace) => ({
      id: `kv-id:${namespace.binding}`,
      status: !hasPlaceholder(namespace.id) ? "pass" : "fail",
      message: !hasPlaceholder(namespace.id)
        ? `KV namespace id for ${namespace.binding} is set.`
        : `KV namespace id for ${namespace.binding} is still a placeholder.`
    })),
    {
      id: "build-output",
      status: existsSync(".svelte-kit/cloudflare/_worker.js") ? "pass" : "warn",
      message: existsSync(".svelte-kit/cloudflare/_worker.js")
        ? "Cloudflare build output exists."
        : "Run preview deploy; it builds before deploying."
    }
  ];
  const failed = checks.filter((check) => check.status === "fail");
  return {
    ok: failed.length === 0,
    data: {
      status: failed.length ? "blocked" : "ready",
      workerName: config.name ?? null,
      d1: d1
        ? {
            binding: d1.binding,
            databaseName: d1.database_name ?? null,
            databaseId: d1.database_id ?? null
          }
        : null,
      kv: allKv.map((namespace) => ({ binding: namespace.binding, namespaceId: namespace.id ?? null })),
      checks,
      nextSteps: failed.length
        ? ["Run preview bind with real Cloudflare D1 and KV ids (include --rate-limit-kv-id for the gateway)."]
        : ["Run preview migrate --confirm migrate, then preview deploy --dry-run."]
    },
    ...(failed.length
      ? {
          error: {
            code: "PREVIEW_NOT_READY",
            message: "Preview bindings are not ready.",
            remediation: "Run microservices preview bind --d1-id <id> --kv-id <id> --rate-limit-kv-id <id> before remote migration or deploy.",
            details: { failed }
          }
        }
      : {})
  };
}

function bindPreview(flags) {
  const loaded = loadWranglerConfig();
  if (!loaded.ok) return loaded;
  const config = loaded.config;
  if (!config) {
    return fail("WRANGLER_CONFIG_MISSING", "wrangler.jsonc was not found.", "Restore wrangler.jsonc before binding resources.");
  }
  if (!flags.d1Id || !flags.kvId) {
    return fail(
      "BINDINGS_REQUIRED",
      "Preview bind requires both --d1-id and --kv-id.",
      "Create or choose Cloudflare resources, then rerun with --d1-id <id> --kv-id <id>."
    );
  }

  const d1 = d1Target(config);
  const allKv = kvTargets(config);
  if (!d1 || allKv.length === 0) {
    return fail("BINDINGS_MISSING", "DB or KV bindings are missing from wrangler.jsonc.", "Restore the template wrangler.jsonc bindings.");
  }

  const snapshot = () => ({
    workerName: config.name ?? null,
    d1DatabaseName: d1.database_name ?? null,
    d1DatabaseId: d1.database_id ?? null,
    kv: allKv.map((namespace) => ({ binding: namespace.binding, id: namespace.id ?? null }))
  });
  const before = snapshot();

  if (flags.workerName) config.name = flags.workerName;
  if (flags.d1Name) d1.database_name = flags.d1Name;
  d1.database_id = flags.d1Id;

  // Rewrite every KV namespace whose id is supplied; leave unresolved ones as
  // placeholders so doctor flags them.
  const appliedKv = [];
  const unresolvedKv = [];
  for (const namespace of allKv) {
    const id = kvIdForBinding(namespace.binding, flags);
    if (id) {
      namespace.id = id;
      appliedKv.push(namespace.binding);
    } else if (hasPlaceholder(namespace.id)) {
      unresolvedKv.push(namespace.binding);
    }
  }

  const after = snapshot();

  if (!flags.dryRun) {
    writeJson("wrangler.jsonc", config);
  }

  return {
    ok: true,
    data: {
      status: flags.dryRun ? "planned" : "bound",
      file: "wrangler.jsonc",
      before,
      after,
      appliedKv,
      unresolvedKv,
      nextSteps: unresolvedKv.length
        ? [`Provide ids for remaining KV bindings: ${unresolvedKv.join(", ")} (e.g. --rate-limit-kv-id <id>).`]
        : ["Run microservices preview doctor, then microservices preview migrate --confirm migrate."]
    }
  };
}

function previewMigration(flags) {
  const readiness = previewReadinessResponse();
  if (!readiness.ok) return readiness;
  const command = { id: "preview:migrate", command: "wrangler", args: ["d1", "migrations", "apply", "DB", "--remote"] };
  if (flags.plan || flags.confirm !== "migrate") {
    return {
      ok: flags.plan,
      data: {
        status: "planned",
        confirmationRequired: "migrate",
        command: commandText(command.command, command.args),
        nextSteps: ["Review the target DB binding, then rerun with --confirm migrate."]
      },
      ...(flags.plan
        ? {}
        : {
            error: {
              code: "MIGRATION_CONFIRMATION_REQUIRED",
              message: "Remote D1 migration requires explicit confirmation.",
              remediation: "Rerun with --confirm migrate after reviewing the target D1 database.",
              details: { confirmationRequired: "migrate" }
            }
          })
    };
  }

  return runCommand(command.id, command.command, command.args, flags);
}

function previewDeploy(flags) {
  const readiness = previewReadinessResponse();
  if (!readiness.ok) return readiness;

  const liveDeploy = flags.confirm === "deploy" && !flags.dryRun;
  if (!flags.dryRun && !liveDeploy) {
    return fail(
      "DEPLOY_CONFIRMATION_REQUIRED",
      "Preview deploy requires --dry-run or --confirm deploy.",
      "Run microservices preview deploy --dry-run first, then rerun with --confirm deploy.",
      { confirmationRequired: "deploy" }
    );
  }

  return runSteps(
    [
      { id: "preview:build", command: "vite", args: ["build"] },
      {
        id: flags.dryRun ? "preview:deploy:dry-run" : "preview:deploy",
        command: "wrangler",
        args: ["deploy", ...(flags.dryRun ? ["--dry-run"] : [])]
      }
    ],
    flags,
    flags.dryRun
      ? ["Run microservices preview deploy --confirm deploy after the dry run passes."]
      : ["Run microservices preview smoke --url <worker-url>."]
  );
}

function previewSmoke(flags, value) {
  const url = flags.url || value || process.env.MICROSERVICES_TEMPLATE_BASE_URL;
  if (!url) {
    return fail(
      "SMOKE_URL_REQUIRED",
      "Preview smoke requires a Worker URL.",
      "Pass --url https://<worker-url> or set MICROSERVICES_TEMPLATE_BASE_URL."
    );
  }
  return runCommand("preview:smoke", "node", ["scripts/smoke-http.mjs", url], flags);
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

function previewCleanupPlan() {
  const loaded = loadWranglerConfig();
  if (!loaded.ok) return loaded;
  const config = loaded.config;
  if (!config) {
    return fail("WRANGLER_CONFIG_MISSING", "wrangler.jsonc was not found.", "Restore wrangler.jsonc before planning cleanup.");
  }

  const d1 = d1Target(config);
  const kv = kvTarget(config);
  const commands = [
    config.name ? `wrangler delete --name ${config.name}` : null,
    d1?.database_name ? `wrangler d1 delete ${d1.database_name}` : null,
    kv?.id && !hasPlaceholder(kv.id) ? `wrangler kv namespace delete --namespace-id ${kv.id}` : null
  ].filter(Boolean);

  return {
    ok: true,
    data: {
      status: "planned",
      destructive: true,
      commands,
      nextSteps: [
        "Review the resources in Cloudflare before deleting.",
        "Destructive preview cleanup is intentionally plan-only in this generated CLI."
      ]
    }
  };
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
  microservices preview doctor [--json]
  microservices preview bind --d1-id <id> --kv-id <id> [--rate-limit-kv-id <id>] [--d1-name <name>] [--worker-name <name>] [--json]
  microservices preview migrate [--plan] --confirm migrate [--json]
  microservices preview deploy --dry-run [--json]
  microservices preview deploy --confirm deploy [--json]
  microservices preview smoke --url <worker-url> [--json]
  microservices preview cleanup --plan [--json]
`;
}

const { args, flags } = parseArgs(process.argv.slice(2));
const [resource, action, value] = args;
const manifest = readJson("microservices.template.json", {});
const lock = readJson("microservices.lock.json", { modules: [] });

if (!resource || resource === "help" || resource === "--help" || resource === "-h") {
  process.stdout.write(usage());
} else if (resource === "modules" && action === "list") {
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
} else if (resource === "preview" && action === "doctor") {
  emit(previewReadinessResponse(), (data) => `Preview readiness: ${data.status}\n`, flags);
} else if (resource === "preview" && action === "bind") {
  emit(bindPreview(flags), (data) => `Preview bindings ${data.status} in ${data.file}.\n`, flags);
} else if (resource === "preview" && action === "migrate") {
  emit(previewMigration(flags), (data) => data.command ? `Preview migration planned: ${data.command}\n` : `Preview migration exited ${data.exitCode}.\n`, flags);
} else if (resource === "preview" && action === "deploy") {
  emit(previewDeploy(flags), (data) => `Preview deploy ${data.status}.\n`, flags);
} else if (resource === "preview" && action === "smoke") {
  emit(previewSmoke(flags, value), (data) => `Preview smoke exited ${data.exitCode}.\n`, flags);
} else if (resource === "preview" && action === "cleanup") {
  emit(previewCleanupPlan(), (data) => `${data.commands.join("\n")}\n`, flags);
} else {
  process.stdout.write(usage());
  process.exitCode = 1;
}
