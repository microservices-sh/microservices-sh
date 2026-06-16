#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORED_DIRS = new Set([".git", ".svelte-kit", ".wrangler", "dist", "node_modules"]);
const FORBIDDEN_FRAMEWORK_IMPORTS = ["@sveltejs/kit", "from \"hono\"", "from 'hono'", "OpenAPIHono"];

// Normalize a module.json manifest to flat summary fields from the nested
// `connections` block (Plan 25 §6). All modules carry `connections` as of
// Phase 3; the legacy flat-field fallbacks have been removed.
export function normalizeManifestConnections(manifest) {
  const c = manifest.connections ?? {};
  const emits = c.events?.emits ?? [];
  const consumes = c.events?.consumes ?? [];
  return {
    requires: c.requires ?? [],
    optional: c.optional ?? [],
    emits,
    consumes,
    events: [...emits, ...consumes],
    hooks: Object.keys(c.hookPoints ?? {}),
    rpc: { exposes: c.rpc?.exposes ?? [], calls: c.rpc?.calls ?? [] }
  };
}

const MODULE_REQUIRED_FILES = [
  "module.json",
  "package.json",
  "README.md",
  "README.agent.md",
  "llms.txt",
  "openapi.json",
  "src/index.ts",
  "src/types.ts",
  "src/schemas.ts",
  "src/hooks.ts",
  "src/manifest/index.ts",
  "src/config/index.ts",
  "src/schema/index.ts",
  "src/hooks/index.ts",
  "src/events/index.ts",
  "src/permissions/index.ts",
  "src/resources/index.ts",
  "src/service/index.ts",
  "src/ports/index.ts",
  "schemas/config.schema.json",
  "schemas/api.schema.json",
  "schemas/events.schema.json",
  "schemas/hooks.schema.json"
];

const MODULE_REQUIRED_EXPORTS = {
  ".": "entrypoint",
  "./types": "./src/types.ts",
  "./schemas": "./src/schemas.ts",
  "./hooks": "./src/hooks.ts",
  "./manifest": "./src/manifest/index.ts",
  "./config": "./src/config/index.ts",
  "./schema": "./src/schema/index.ts",
  "./events": "./src/events/index.ts",
  "./permissions": "./src/permissions/index.ts",
  "./resources": "./src/resources/index.ts",
  "./service": "./src/service/index.ts",
  "./ports": "./src/ports/index.ts"
};

const TEMPLATE_REQUIRED_FILES = [
  "microservices.template.json",
  "microservices.config.json",
  "microservices.lock.json",
  "package.json",
  "README.agent.md",
  "docs/llms.txt",
  "docs/api-boundary.md",
  "tsconfig.json",
  "wrangler.jsonc",
  "scripts/microservices.js"
];

const SVELTEKIT_REQUIRED_FILES = [
  "svelte.config.js",
  "vite.config.ts",
  "src/app.html",
  "src/app.css",
  "src/app.d.ts",
  "src/hooks.server.ts",
  "src/routes/+layout.svelte",
  "src/routes/+page.svelte"
];

function usage() {
  return `microservices-workspace

Usage:
  microservices-workspace check
  microservices-workspace check all
  microservices-workspace check modules
  microservices-workspace check templates
  microservices-workspace check module <path>
  microservices-workspace check template <path>
  microservices-workspace scaffold module <id>
  microservices-workspace scaffold template <id>
  microservices-workspace registry build
  microservices-workspace shims sync
  microservices-workspace shims check
  microservices-workspace discover

Options:
  --path <path>       Target path for single-target checks or scaffold output
  --name <name>       Display name for scaffolded packages
  --summary <text>    Summary for scaffolded manifests and docs
  --class <value>     Module class. Default: core
  --category <value>  Template category. Default: business-system
  --framework <name>  Template framework. Default: generic
  --modules <ids>     Comma-separated required module ids for templates
  --out <path>        Output directory for generated registry files
  --force             Allow overwriting generated scaffold files
  --json              Print machine-readable output
`;
}

function parseArgs(argv) {
  const flags = {
    json: false,
    path: null,
    name: null,
    summary: null,
    className: "core",
    category: "business-system",
    framework: "generic",
    modules: [],
    out: null,
    force: false
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    } else if (value === "--json") {
      flags.json = true;
    } else if (value === "--path") {
      flags.path = argv[index + 1] || null;
      index += 1;
    } else if (value === "--name") {
      flags.name = argv[index + 1] || null;
      index += 1;
    } else if (value === "--summary") {
      flags.summary = argv[index + 1] || null;
      index += 1;
    } else if (value === "--class") {
      flags.className = argv[index + 1] || flags.className;
      index += 1;
    } else if (value === "--category") {
      flags.category = argv[index + 1] || flags.category;
      index += 1;
    } else if (value === "--framework") {
      flags.framework = argv[index + 1] || flags.framework;
      index += 1;
    } else if (value === "--modules") {
      flags.modules = csv(argv[index + 1] || "");
      index += 1;
    } else if (value === "--out") {
      flags.out = argv[index + 1] || null;
      index += 1;
    } else if (value === "--force") {
      flags.force = true;
    } else if (value === "--help" || value === "-h") {
      positionals.push("help");
    } else {
      positionals.push(value);
    }
  }

  return {
    command: positionals[0] || "check",
    scope: positionals[1] || "all",
    positionalPath: positionals[2] || null,
    flags
  };
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readJsonOptional(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return readJson(path);
}

function failCheck(id, message) {
  const error = new Error(message);
  error.checkId = id;
  throw error;
}

function record(checks, id, message) {
  checks.push({ id, status: "pass", message });
}

function assertCheck(checks, id, condition, message) {
  if (!condition) {
    failCheck(id, message);
  }
  record(checks, id, message);
}

function findWorkspaceRoot(startPath) {
  let current = resolve(startPath);

  while (current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    current = dirname(current);
  }

  return resolve(startPath);
}

function resolveFromCwd(path) {
  if (!path) return process.cwd();
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function assertPackageId(id, kind) {
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(id)) {
    failCheck(`${kind}:id`, `${kind} id must use lowercase kebab-case and start with a letter: ${id}`);
  }
}

function titleCase(id) {
  return id.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function pascalCase(id) {
  return id.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
}

function camelCase(id) {
  const value = pascalCase(id);
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function snakeCase(id) {
  return id.replace(/[^a-z0-9]+/g, "_");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeScaffoldFiles(targetPath, files, force) {
  const written = [];

  for (const file of files) {
    const outputPath = join(targetPath, file.path);
    if (existsSync(outputPath) && !force) {
      failCheck("scaffold:file-exists", `Refusing to overwrite existing file: ${outputPath}`);
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.contents);
    written.push(outputPath);
  }

  return written;
}

async function listDirectories(path) {
  if (!existsSync(path)) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(path, entry.name));
}

async function listFiles(path) {
  if (!existsSync(path)) return [];
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...await listFiles(entryPath));
      }
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function relativeToRoot(rootPath, targetPath) {
  return relative(rootPath, targetPath) || ".";
}

function assertRequiredFiles(checks, targetPath, files, label) {
  const missing = files.filter((file) => !existsSync(join(targetPath, file)));
  assertCheck(
    checks,
    `${label}:required-files`,
    missing.length === 0,
    missing.length === 0
      ? `${label} required files are present.`
      : `Missing required ${label} files:\n${missing.map((file) => `- ${file}`).join("\n")}`
  );
}

function hasD1Resource(manifest) {
  return Array.isArray(manifest.resources) && manifest.resources.some((resource) => resource.type === "d1");
}

async function hasSqlMigration(targetPath) {
  const migrationsPath = join(targetPath, "migrations");
  if (!existsSync(migrationsPath)) return false;
  const files = await listFiles(migrationsPath);
  return files.some((file) => file.endsWith(".sql"));
}

async function findCheckTargets(rootPath, scope) {
  if (scope === "module") return [];
  if (scope === "template") return [];

  const targets = [];

  if (scope === "all" || scope === "modules") {
    for (const directory of await listDirectories(join(rootPath, "modules"))) {
      if (existsSync(join(directory, "module.json"))) {
        targets.push({ kind: "module", path: directory });
      }
    }
  }

  if (scope === "all" || scope === "templates") {
    for (const directory of await listDirectories(join(rootPath, "templates"))) {
      if (existsSync(join(directory, "microservices.template.json"))) {
        targets.push({ kind: "template", path: directory });
      }
    }
  }

  return targets;
}

function packageHasScript(packageJson, scriptName, expectedText) {
  const script = packageJson.scripts?.[scriptName];
  return typeof script === "string" && script.includes(expectedText);
}

function normalizeExportPath(value) {
  return value?.startsWith("./") ? value : `./${value}`;
}

async function assertFrameworkNeutralSource(checks, targetPath) {
  const sourceRoots = ["src/index.ts", "src/use-cases", "src/ports", "src/adapters", "src/service"];
  const files = [];

  for (const sourceRoot of sourceRoots) {
    const sourcePath = join(targetPath, sourceRoot);
    if (!existsSync(sourcePath)) continue;
    if (sourcePath.endsWith(".ts")) {
      files.push(sourcePath);
    } else {
      files.push(...await listFiles(sourcePath));
    }
  }

  for (const file of files.filter((sourceFile) => sourceFile.endsWith(".ts"))) {
    const source = readText(file);
    const forbidden = FORBIDDEN_FRAMEWORK_IMPORTS.find((needle) => source.includes(needle));
    assertCheck(
      checks,
      `module:framework-neutral:${relative(targetPath, file)}`,
      !forbidden,
      forbidden
        ? `${relative(targetPath, file)} must stay framework-neutral and not reference ${forbidden}.`
        : `${relative(targetPath, file)} is framework-neutral.`
    );
  }
}

function createPolicyContext({ checks, kind, rootPath, targetPath, manifest, lock, packageJson }) {
  function target(relativePath) {
    return join(targetPath, relativePath);
  }

  return {
    kind,
    rootPath,
    targetPath,
    manifest,
    lock,
    packageJson,
    exists(relativePath) {
      return existsSync(target(relativePath));
    },
    readText(relativePath) {
      return readText(target(relativePath));
    },
    readJson(relativePath) {
      return readJson(target(relativePath));
    },
    assert(condition, message, id = "policy:assert") {
      assertCheck(checks, id, condition, message);
    },
    assertFileIncludes(relativePath, expected, message) {
      const source = readText(target(relativePath));
      assertCheck(
        checks,
        `policy:${relativePath}:includes:${expected}`,
        source.includes(expected),
        message
      );
    },
    assertFileIncludesAll(relativePath, expectedValues, message) {
      const source = readText(target(relativePath));
      for (const expected of expectedValues) {
        assertCheck(
          checks,
          `policy:${relativePath}:includes:${expected}`,
          source.includes(expected),
          message
        );
      }
    },
    assertFileExcludes(relativePath, unexpected, message) {
      const source = readText(target(relativePath));
      assertCheck(
        checks,
        `policy:${relativePath}:excludes:${unexpected}`,
        !source.includes(unexpected),
        message
      );
    }
  };
}

async function runPolicy({ checks, kind, rootPath, targetPath, manifest, lock, packageJson }) {
  const policyPath = join(targetPath, "microservices.check.mjs");
  if (!existsSync(policyPath)) {
    record(checks, "policy:optional", "No package-specific policy file present.");
    return;
  }

  const module = await import(pathToFileURL(policyPath).href);
  const check = module.default || module.check;
  assertCheck(checks, "policy:load", typeof check === "function", "Package-specific policy file exports a check function.");

  const context = createPolicyContext({ checks, kind, rootPath, targetPath, manifest, lock, packageJson });
  await check(context);
  record(checks, "policy:complete", "Package-specific policy checks passed.");
}

async function checkModule(targetPath, rootPath) {
  const checks = [];
  assertRequiredFiles(checks, targetPath, MODULE_REQUIRED_FILES, "module");

  const manifest = readJson(join(targetPath, "module.json"));
  const packageJson = readJson(join(targetPath, "package.json"));
  const entrypoint = manifest.entrypoint || "src/index.ts";
  const expectedPackageName = `@microservices-sh/${manifest.id}`;

  assertCheck(checks, "module:id", typeof manifest.id === "string" && manifest.id.length > 0, "Module manifest has an id.");
  assertCheck(checks, "module:package-name", packageJson.name === expectedPackageName, `Package name is ${expectedPackageName}.`);
  assertCheck(checks, "module:entrypoint", existsSync(join(targetPath, entrypoint)), `Module entrypoint exists at ${entrypoint}.`);
  assertCheck(checks, "module:check-script", packageHasScript(packageJson, "check:spec", "workspace-tools"), "Module check:spec uses the shared workspace checker.");

  for (const [exportName, exportPath] of Object.entries(MODULE_REQUIRED_EXPORTS)) {
    const expected = exportPath === "entrypoint" ? normalizeExportPath(entrypoint) : exportPath;
    assertCheck(
      checks,
      `module:export:${exportName}`,
      packageJson.exports?.[exportName] === expected,
      `Module export ${exportName} points to ${expected}.`
    );
  }

  if (hasD1Resource(manifest)) {
    assertCheck(checks, "module:migrations", await hasSqlMigration(targetPath), "D1 module has at least one SQL migration.");
  }

  if (manifest.runtime?.frameworkNeutral) {
    await assertFrameworkNeutralSource(checks, targetPath);
  }

  await runPolicy({ checks, kind: "module", rootPath, targetPath, manifest, lock: null, packageJson });

  return {
    kind: "module",
    id: manifest.id,
    path: relativeToRoot(rootPath, targetPath),
    checks
  };
}

function moduleIdsFromTemplate(manifest) {
  const required = Array.isArray(manifest.modules?.required) ? manifest.modules.required : [];
  const slots = Object.values(manifest.slots || {})
    .map((slot) => slot?.activeModule)
    .filter(Boolean);
  return [...new Set([...required, ...slots])];
}

function localModulePackageName(rootPath, moduleId) {
  const packagePath = join(rootPath, "modules", moduleId, "package.json");
  if (!existsSync(packagePath)) return null;
  return readJson(packagePath).name;
}

async function checkTemplate(targetPath, rootPath) {
  const checks = [];
  assertRequiredFiles(checks, targetPath, TEMPLATE_REQUIRED_FILES, "template");

  const manifest = readJson(join(targetPath, "microservices.template.json"));
  const lock = readJson(join(targetPath, "microservices.lock.json"));
  const packageJson = readJson(join(targetPath, "package.json"));

  assertCheck(checks, "template:id", typeof manifest.id === "string" && manifest.id.length > 0, "Template manifest has an id.");
  assertCheck(checks, "template:lock-id", lock.template?.id === manifest.id, `Lockfile template id matches ${manifest.id}.`);
  assertCheck(checks, "template:check-script", packageHasScript(packageJson, "check:spec", "workspace-tools"), "Template check:spec uses the shared workspace checker.");

  if (manifest.runtime?.framework === "sveltekit") {
    assertRequiredFiles(checks, targetPath, SVELTEKIT_REQUIRED_FILES, "sveltekit template");
  }

  const lockModuleIds = Array.isArray(lock.modules) ? lock.modules.map((module) => module.id) : [];
  for (const moduleId of moduleIdsFromTemplate(manifest)) {
    assertCheck(
      checks,
      `template:lock-module:${moduleId}`,
      lockModuleIds.includes(moduleId),
      `Lockfile includes required template module ${moduleId}.`
    );

    const packageName = localModulePackageName(rootPath, moduleId);
    if (packageName) {
      assertCheck(
        checks,
        `template:dependency:${packageName}`,
        packageJson.dependencies?.[packageName] === "workspace:*",
        `Template depends on local module package ${packageName}.`
      );
    }
  }

  const vendoredModuleFiles = await listFiles(join(targetPath, "src/lib/server/modules"));
  assertCheck(
    checks,
    "template:no-vendored-modules",
    vendoredModuleFiles.length === 0,
    "Template does not own vendored module internals."
  );

  await runPolicy({ checks, kind: "template", rootPath, targetPath, manifest, lock, packageJson });

  return {
    kind: "template",
    id: manifest.id,
    path: relativeToRoot(rootPath, targetPath),
    checks
  };
}

async function checkTarget(kind, targetPath, rootPath) {
  if (kind === "module") return checkModule(targetPath, rootPath);
  if (kind === "template") return checkTemplate(targetPath, rootPath);
  failCheck("command:kind", `Unknown check kind: ${kind}`);
}

async function runCheck({ scope, flags, positionalPath }) {
  const rootPath = findWorkspaceRoot(process.cwd());

  if (scope === "module" || scope === "template") {
    const targetPath = resolveFromCwd(flags.path || positionalPath || ".");
    return {
      checked: [await checkTarget(scope, targetPath, rootPath)]
    };
  }

  if (!["all", "modules", "templates"].includes(scope)) {
    failCheck("command:scope", `Unknown check scope: ${scope}`);
  }

  const targets = await findCheckTargets(rootPath, scope);
  const checked = [];

  for (const target of targets) {
    checked.push(await checkTarget(target.kind, target.path, rootPath));
  }

  return { checked };
}

function moduleScaffoldFiles({ id, name, summary, className }) {
  const camelId = camelCase(id);
  const pascalId = pascalCase(id);
  const tableName = `${snakeCase(id)}_records`;
  const packageName = `@microservices-sh/${id}`;

  const manifest = {
    schemaVersion: "2026-06-13",
    id,
    name,
    version: "0.1.0",
    status: "draft",
    class: className,
    summary,
    runtime: {
      language: "typescript",
      platform: "cloudflare-workers",
      frameworkNeutral: true,
      routeAdapters: ["hono-later", "sveltekit-later"]
    },
    entrypoint: "src/index.ts",
    resources: [
      { type: "d1", binding: "DB", tables: [tableName, "domain_events"] }
    ],
    permissions: [`${id}.read`, `${id}.write`, `${id}.admin`, `${id}.extend`, `${id}.observe`],
    connections: {
      requires: [],
      optional: ["auth", "audit-log"],
      rpc: { exposes: [], calls: [] },
      events: { emits: [`${id}.created`, `${id}.updated`], consumes: [] },
      hookPoints: {
        [`before${pascalId}Create`]: { kind: "filter", scope: `${id}.extend` },
        [`after${pascalId}Updated`]: { kind: "observer", scope: `${id}.observe` }
      },
      provides: { hooks: [] }
    },
    customization: {
      default: "config-hooks",
      supported: ["config", "hooks", "overlay", "fork"]
    },
    approval: {
      risk: "medium",
      requiresApprovalFor: ["migrations", "pii-fields", "production-deploy", "external-side-effects"]
    }
  };

  const packageJson = {
    name: packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    description: summary,
    exports: {
      ".": "./src/index.ts",
      "./types": "./src/types.ts",
      "./schemas": "./src/schemas.ts",
      "./hooks": "./src/hooks.ts",
      "./manifest": "./src/manifest/index.ts",
      "./config": "./src/config/index.ts",
      "./schema": "./src/schema/index.ts",
      "./events": "./src/events/index.ts",
      "./permissions": "./src/permissions/index.ts",
      "./resources": "./src/resources/index.ts",
      "./service": "./src/service/index.ts",
      "./ports": "./src/ports/index.ts"
    },
    scripts: {
      build: "tsc --noEmit",
      "check:spec": "node ../../packages/workspace-tools/src/index.js check module --path ."
    },
    dependencies: {
      "@microservices-sh/connection-contract": "workspace:*",
      zod: "^3.25.76"
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20250109.0",
      typescript: "^5.9.3"
    }
  };

  const openapi = {
    openapi: "3.1.0",
    info: { title: `${name} Module`, version: "0.1.0" },
    paths: {}
  };

  const configSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${name} Config`,
    type: "object",
    additionalProperties: true,
    properties: {
      enabled: { type: "boolean", default: true }
    }
  };

  const apiSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${name} API`,
    type: "object",
    additionalProperties: true
  };

  const scaffoldEvents = manifest.connections.events.emits;
  const scaffoldHooks = Object.keys(manifest.connections.hookPoints);

  const eventsSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${name} Events`,
    type: "object",
    enum: scaffoldEvents
  };

  const hooksSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${name} Hooks`,
    type: "object",
    properties: Object.fromEntries(scaffoldHooks.map((hook) => [hook, { type: "string" }]))
  };

  return [
    { path: "module.json", contents: json(manifest) },
    { path: "package.json", contents: json(packageJson) },
    { path: "README.md", contents: `# ${name} Module\n\nStatus: \`draft\`\n\n${summary}\n\n## Public Surface\n\n\`\`\`ts\nimport { ${camelId}Module } from "${packageName}";\n\`\`\`\n\n## Ownership Boundary\n\nThe module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for \`${id}\`.\n\nTemplates own app shell, route adapters, UI layout, and framework-specific response mapping.\n` },
    { path: "README.agent.md", contents: `# ${name} Module Agent Guide\n\nUse this module through \`${packageName}\`.\n\nSafe first actions:\n\n1. Read \`module.json\`.\n2. Read \`llms.txt\`.\n3. Inspect \`src/index.ts\` exports.\n4. Run \`pnpm check:spec\`.\n5. Run \`pnpm build\` after source edits.\n\nDo not add provider calls, secrets, migrations, or production deploy behavior without approval.\n` },
    { path: "llms.txt", contents: `# ${name} Module\n\nModule ID: ${id}\nStatus: draft\nPurpose: ${summary}\nEntrypoint: src/index.ts\nCheck: pnpm check:spec\nBuild: pnpm build\n` },
    { path: "openapi.json", contents: json(openapi) },
    { path: "schemas/config.schema.json", contents: json(configSchema) },
    { path: "schemas/api.schema.json", contents: json(apiSchema) },
    { path: "schemas/events.schema.json", contents: json(eventsSchema) },
    { path: "schemas/hooks.schema.json", contents: json(hooksSchema) },
    { path: "migrations/0001_initial.sql", contents: `CREATE TABLE IF NOT EXISTS ${tableName} (\n  id TEXT PRIMARY KEY,\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  data TEXT NOT NULL DEFAULT '{}'\n);\n\nCREATE TABLE IF NOT EXISTS domain_events (\n  id TEXT PRIMARY KEY,\n  event_type TEXT NOT NULL,\n  aggregate_id TEXT,\n  payload TEXT NOT NULL DEFAULT '{}',\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName} (created_at);\n` },
    { path: "src/types.ts", contents: `export interface ${pascalId}Config {\n  enabled: boolean;\n}\n\nexport interface ${pascalId}Record {\n  id: string;\n  createdAt: string;\n  updatedAt: string;\n  data: Record<string, unknown>;\n}\n\nexport interface ModuleResult<T> {\n  ok: boolean;\n  data?: T;\n  error?: { code: string; message: string };\n}\n` },
    { path: "src/schemas.ts", contents: `import { z } from "zod";\n\nexport const ${camelId}ConfigSchema = z.object({\n  enabled: z.boolean().default(true)\n});\n\nexport const ${camelId}RecordSchema = z.object({\n  id: z.string().min(1),\n  createdAt: z.string().min(1),\n  updatedAt: z.string().min(1),\n  data: z.record(z.unknown()).default({})\n});\n` },
    { path: "src/hooks.ts", contents: `export interface ${pascalId}Hooks {\n  before${pascalId}Create?: (input: unknown) => Promise<unknown> | unknown;\n  after${pascalId}Updated?: (record: unknown) => Promise<void> | void;\n}\n\nexport const default${pascalId}Hooks: Required<${pascalId}Hooks> = {\n  before${pascalId}Create(input) {\n    return input;\n  },\n  after${pascalId}Updated() {\n    return undefined;\n  }\n};\n` },
    { path: "src/index.ts", contents: `export { manifest } from "./manifest";\nexport { ${camelId}ConfigSchema, ${camelId}RecordSchema } from "./schemas";\nexport { default${pascalId}Hooks } from "./hooks";\nexport { ${camelId}Events } from "./events";\nexport { ${camelId}Permissions } from "./permissions";\nexport { ${camelId}Resources } from "./resources";\nexport type { ${pascalId}Config, ${pascalId}Record, ModuleResult } from "./types";\n\nexport const ${camelId}Module = {\n  id: "${id}",\n  version: "0.1.0"\n} as const;\n` },
    { path: "src/manifest/index.ts", contents: `export const manifest = ${JSON.stringify(manifest, null, 2)} as const;\n` },
    { path: "src/config/index.ts", contents: `import { ${camelId}ConfigSchema } from "../schemas";\n\nexport const configSchema = ${camelId}ConfigSchema;\nexport const defaultConfig = configSchema.parse({ enabled: true });\n` },
    { path: "src/schema/index.ts", contents: `export { ${camelId}ConfigSchema, ${camelId}RecordSchema } from "../schemas";\n` },
    { path: "src/hooks/index.ts", contents: `export { default${pascalId}Hooks } from "../hooks";\nexport type { ${pascalId}Hooks } from "../hooks";\n` },
    { path: "src/events/index.ts", contents: `export const ${camelId}Events = ${JSON.stringify({ emitted: scaffoldEvents, consumed: [] }, null, 2)} as const;\n` },
    { path: "src/permissions/index.ts", contents: `export const ${camelId}Permissions = ${JSON.stringify(manifest.permissions, null, 2)} as const;\n` },
    { path: "src/resources/index.ts", contents: `export const ${camelId}Resources = ${JSON.stringify(manifest.resources, null, 2)} as const;\n` },
    { path: "src/service/index.ts", contents: `export function get${pascalId}ModuleStatus() {\n  return { id: "${id}", status: "draft" } as const;\n}\n` },
    { path: "src/ports/index.ts", contents: `export interface ${pascalId}Repository {\n  getById(id: string): Promise<unknown | null>;\n}\n` },
    { path: "src/use-cases/README.md", contents: `# ${name} Use Cases\n\nAdd framework-neutral use cases here. Do not import SvelteKit, Hono, provider clients, or secret values directly in use cases.\n` },
    { path: "src/adapters/README.md", contents: `# ${name} Adapters\n\nAdd D1, memory, provider, or framework adapters here. Keep provider side effects behind explicit function calls.\n` },
    { path: "tests/unit/README.md", contents: `# ${name} Tests\n\nAdd unit tests for schemas, hooks, use cases, and adapters.\n` },
    { path: "microservices.check.mjs", contents: `export default function check({ assertFileIncludes }) {\n  assertFileIncludes(\n    "migrations/0001_initial.sql",\n    "CREATE TABLE IF NOT EXISTS ${tableName}",\n    "${name} module migration owns its primary table."\n  );\n}\n` }
  ];
}

function lockModuleSnapshot(rootPath, moduleId) {
  const modulePath = join(rootPath, "modules", moduleId, "module.json");
  if (!existsSync(modulePath)) {
    return {
      id: moduleId,
      version: "0.1.0",
      source: `registry:${moduleId}@0.1.0`,
      checksum: `sha256:scaffold-${moduleId}-0.1.0`,
      customizationMode: "config-hooks",
      contract: {
        resources: [],
        permissions: [],
        hooks: [],
        events: [],
        requires: []
      }
    };
  }

  const manifest = readJson(modulePath);
  const connections = normalizeManifestConnections(manifest);
  return {
    id: moduleId,
    version: manifest.version || "0.1.0",
    source: `registry:${moduleId}@${manifest.version || "0.1.0"}`,
    checksum: `sha256:scaffold-${moduleId}-${manifest.version || "0.1.0"}`,
    customizationMode: manifest.customization?.default || "config-hooks",
    contract: {
      resources: Array.isArray(manifest.resources) ? manifest.resources.map((resource) => resource.type?.toUpperCase()).filter(Boolean) : [],
      permissions: manifest.permissions || [],
      hooks: connections.hooks,
      events: connections.events,
      requires: connections.requires
    }
  };
}

function templateDependencies(rootPath, moduleIds, framework) {
  const dependencies = {};

  for (const moduleId of moduleIds) {
    const packageName = localModulePackageName(rootPath, moduleId);
    if (packageName) {
      dependencies[packageName] = "workspace:*";
    }
  }

  if (framework === "sveltekit") {
    dependencies["@sveltejs/adapter-cloudflare"] = "^7.2.4";
    dependencies["@sveltejs/kit"] = "^2.9.0";
    dependencies.svelte = "^5.0.0";
    dependencies.vite = "^5.0.0";
  }

  return dependencies;
}

function templateScaffoldFiles({ id, name, summary, category, framework, moduleIds, rootPath }) {
  const isSvelteKit = framework === "sveltekit";
  const dependencies = templateDependencies(rootPath, moduleIds, framework);

  const manifest = {
    schemaVersion: "2026-06-13",
    id,
    version: "0.1.0",
    status: "draft",
    displayName: name,
    category,
    summary,
    runtime: isSvelteKit
      ? {
          language: "typescript",
          framework: "sveltekit",
          adapter: "@sveltejs/adapter-cloudflare",
          platform: "cloudflare-workers",
          entrypoint: ".svelte-kit/cloudflare/_worker.js"
        }
      : {
          language: "typescript",
          framework: "generic",
          platform: "cloudflare-workers",
          entrypoint: "src/index.ts"
        },
    deployment: {
      defaultMode: "managed-cloudflare",
      managedNamespace: "microservices-sh",
      byoCloudflare: "later"
    },
    modules: {
      required: moduleIds,
      optional: ["auth", "audit-log", "payment", "email"]
    },
    slots: {},
    sourcePolicy: {
      templateOwns: ["app shell", "routes", "layout", "composition glue"],
      modulesOwn: ["domain behavior", "schemas", "use cases", "ports", "migrations"],
      apiLogic: "detached-use-cases-with-framework-adapters"
    }
  };

  const lockfile = {
    schemaVersion: "2026-06-13",
    generatedAt: "template-scaffold",
    registry: {
      id: "microservices.sh",
      contractVersion: "2026-06-13"
    },
    generator: {
      package: "@microservices-sh/workspace-tools",
      version: "0.1.0"
    },
    template: {
      id,
      version: "0.1.0",
      source: `registry:${id}@0.1.0`,
      checksum: `sha256:scaffold-${id}-0.1.0`
    },
    modules: moduleIds.map((moduleId) => lockModuleSnapshot(rootPath, moduleId)),
    customizations: {
      config: true,
      hooks: [],
      overlays: [],
      forks: []
    }
  };

  const packageJson = {
    name: `@microservices-sh/template-${id}`,
    version: "0.1.0",
    private: true,
    type: "module",
    description: summary,
    scripts: {
      build: isSvelteKit ? "vite build" : "node --check scripts/microservices.js",
      "check:spec": "node ../../packages/workspace-tools/src/index.js check template --path .",
      microservices: "node scripts/microservices.js"
    },
    dependencies,
    devDependencies: isSvelteKit
      ? {
          "@cloudflare/workers-types": "^4.20250109.0",
          "@sveltejs/vite-plugin-svelte": "^4.0.4",
          typescript: "^5.9.3",
          wrangler: "^4.58.0"
        }
      : {
          typescript: "^5.9.3",
          wrangler: "^4.58.0"
        }
  };

  const files = [
    { path: "microservices.template.json", contents: json(manifest) },
    { path: "microservices.config.json", contents: json({ template: id, modules: Object.fromEntries(moduleIds.map((moduleId) => [moduleId, { enabled: true }])) }) },
    { path: "microservices.lock.json", contents: json(lockfile) },
    { path: "package.json", contents: json(packageJson) },
    { path: "README.md", contents: `# ${name} Template\n\nStatus: \`draft\`\n\n${summary}\n\n## Modules\n\n${moduleIds.length ? moduleIds.map((moduleId) => `- ${moduleId}`).join("\n") : "- none yet"}\n\n## Verification\n\n\`\`\`bash\npnpm check:spec\npnpm microservices check --json\n\`\`\`\n` },
    { path: "README.agent.md", contents: `# ${name} Template Agent Guide\n\nUse this template as a source-visible starting point.\n\nSafe first actions:\n\n1. Read \`microservices.template.json\`.\n2. Read \`microservices.lock.json\`.\n3. Read \`docs/llms.txt\`.\n4. Run \`pnpm check:spec\`.\n5. Run \`pnpm microservices check --json\`.\n\nDo not add payment, email, auth, webhook, migration, secret, or production deploy behavior without approval.\n` },
    { path: "docs/llms.txt", contents: `# ${name} Template\n\nTemplate ID: ${id}\nStatus: draft\nPurpose: ${summary}\nFramework: ${framework}\nRequired modules: ${moduleIds.join(", ") || "none"}\nCheck: pnpm check:spec\n` },
    { path: "docs/api-boundary.md", contents: `# API Boundary\n\n## Use Case Shape\n\nDomain behavior should live in module use cases, not template routes.\n\n## Route Adapter Shape\n\nTemplate routes should parse framework inputs, call module use cases, and map results to framework responses.\n` },
    { path: "tsconfig.json", contents: json(isSvelteKit ? { extends: "./.svelte-kit/tsconfig.json", compilerOptions: { allowJs: true, checkJs: true, esModuleInterop: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true, skipLibCheck: true, sourceMap: true, strict: true, moduleResolution: "bundler" } } : { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, resolveJsonModule: true } }) },
    { path: "wrangler.jsonc", contents: `{\n  "name": "${id}",\n  "main": "${isSvelteKit ? ".svelte-kit/cloudflare/_worker.js" : "src/index.ts"}",\n  "compatibility_date": "2026-06-13",\n  "compatibility_flags": ["nodejs_compat"]\n}\n` },
    { path: "scripts/microservices.js", contents: `#!/usr/bin/env node\nconst command = process.argv[2] || "help";\n\nfunction write(value) {\n  process.stdout.write(JSON.stringify(value, null, 2) + "\\n");\n}\n\nif (command === "check") {\n  write({ ok: true, data: { status: "pass", template: "${id}" }, warnings: [] });\n} else {\n  write({ ok: true, data: { template: "${id}", commands: ["check"] }, warnings: [] });\n}\n` },
    { path: "microservices.check.mjs", contents: `export default function check({ assertFileIncludesAll }) {\n  assertFileIncludesAll(\n    "docs/api-boundary.md",\n    ["Use Case Shape", "Route Adapter Shape"],\n    "${name} template documents API boundaries."\n  );\n}\n` }
  ];

  if (!isSvelteKit) {
    files.push({ path: "src/index.ts", contents: `export default {\n  fetch() {\n    return new Response("${name} scaffold");\n  }\n};\n` });
    return files;
  }

  files.push(
    { path: "svelte.config.js", contents: `import adapter from "@sveltejs/adapter-cloudflare";\n\nexport default {\n  kit: {\n    adapter: adapter({\n      platformProxy: {\n        configPath: "wrangler.jsonc",\n        persist: true\n      }\n    })\n  }\n};\n` },
    { path: "vite.config.ts", contents: `import { sveltekit } from "@sveltejs/kit/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [sveltekit()]\n});\n` },
    { path: "src/app.html", contents: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div>%sveltekit.body%</div>\n  </body>\n</html>\n` },
    { path: "src/app.css", contents: `:root {\n  color: #17201b;\n  background: #f7faf8;\n  font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n}\n\n.shell {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 32px 20px;\n}\n` },
    { path: "src/app.d.ts", contents: `declare global {\n  namespace App {\n    interface Locals {}\n    interface Platform {}\n  }\n}\n\nexport {};\n` },
    { path: "src/hooks.server.ts", contents: `import type { Handle } from "@sveltejs/kit";\n\nexport const handle: Handle = async ({ event, resolve }) => {\n  return resolve(event);\n};\n` },
    { path: "src/routes/+layout.svelte", contents: `<script lang="ts">\n  import "../app.css";\n\n  let { children } = $props();\n</script>\n\n<div class="shell">\n  {@render children()}\n</div>\n` },
    { path: "src/routes/+page.svelte", contents: `<svelte:head>\n  <title>${name}</title>\n</svelte:head>\n\n<h1>${name}</h1>\n<p>${summary}</p>\n` }
  );

  return files;
}

async function scaffoldModule({ id, flags, rootPath }) {
  assertPackageId(id, "module");
  const name = flags.name || titleCase(id);
  const summary = flags.summary || `${name} module for microservices.sh templates.`;
  const targetPath = flags.path ? resolveFromCwd(flags.path) : join(rootPath, "modules", id);
  const files = moduleScaffoldFiles({ id, name, summary, className: flags.className });
  const written = await writeScaffoldFiles(targetPath, files, flags.force);

  return {
    kind: "module",
    id,
    path: relativeToRoot(rootPath, targetPath),
    written: written.map((path) => relativeToRoot(rootPath, path)),
    nextCommands: [
      `pnpm spec:check -- module ${relativeToRoot(rootPath, targetPath)}`,
      `pnpm --filter @microservices-sh/${id} build`
    ]
  };
}

async function scaffoldTemplate({ id, flags, rootPath }) {
  assertPackageId(id, "template");
  const name = flags.name || titleCase(id);
  const summary = flags.summary || `${name} template for microservices.sh generated apps.`;
  const targetPath = flags.path ? resolveFromCwd(flags.path) : join(rootPath, "templates", id);
  const files = templateScaffoldFiles({
    id,
    name,
    summary,
    category: flags.category,
    framework: flags.framework,
    moduleIds: flags.modules,
    rootPath
  });
  const written = await writeScaffoldFiles(targetPath, files, flags.force);

  return {
    kind: "template",
    id,
    path: relativeToRoot(rootPath, targetPath),
    written: written.map((path) => relativeToRoot(rootPath, path)),
    nextCommands: [
      `pnpm spec:check -- template ${relativeToRoot(rootPath, targetPath)}`,
      `pnpm --filter @microservices-sh/template-${id} build`
    ]
  };
}

async function runScaffold({ scope, positionalPath, flags }) {
  const rootPath = findWorkspaceRoot(process.cwd());
  const id = positionalPath;

  if (!id) {
    failCheck("scaffold:id", "Scaffold id is required.");
  }

  if (scope === "module") {
    return { scaffolded: await scaffoldModule({ id, flags, rootPath }) };
  }

  if (scope === "template") {
    return { scaffolded: await scaffoldTemplate({ id, flags, rootPath }) };
  }

  failCheck("scaffold:kind", `Unknown scaffold kind: ${scope}`);
}

async function listRelativeFiles(targetPath, directory, extension = null) {
  const directoryPath = join(targetPath, directory);
  const files = await listFiles(directoryPath);
  return files
    .filter((file) => !extension || file.endsWith(extension))
    .map((file) => relative(targetPath, file))
    .sort();
}

function resourceSummary(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((resource) => {
    if (typeof resource === "string") return resource;
    const label = [resource.type?.toUpperCase(), resource.binding].filter(Boolean).join(":");
    return label || resource.type || "resource";
  });
}

function bindingSummary(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((resource) => resource?.binding).filter(Boolean).sort();
}

async function moduleRegistryEntry(rootPath, modulePath) {
  const manifest = readJson(join(modulePath, "module.json"));
  const packageJson = readJsonOptional(join(modulePath, "package.json"), {});
  const connections = normalizeManifestConnections(manifest);
  const moduleClass = manifest.class || manifest.category || "module";
  const docs = {
    readme: existsSync(join(modulePath, "README.md")) ? "README.md" : null,
    agent: existsSync(join(modulePath, "README.agent.md")) ? "README.agent.md" : null,
    llms: existsSync(join(modulePath, "llms.txt")) ? "llms.txt" : null,
    openapi: existsSync(join(modulePath, "openapi.json")) ? "openapi.json" : null
  };

  return {
    id: manifest.id,
    name: manifest.name || titleCase(manifest.id),
    version: manifest.version || "0.0.0",
    status: manifest.status || "draft",
    class: moduleClass,
    summary: manifest.summary || "",
    package: packageJson.name || `@microservices-sh/${manifest.id}`,
    path: relativeToRoot(rootPath, modulePath),
    manifestPath: relativeToRoot(rootPath, join(modulePath, "module.json")),
    entrypoint: manifest.entrypoint || "src/index.ts",
    runtime: manifest.runtime || {},
    resources: resourceSummary(manifest.resources),
    bindings: bindingSummary(manifest.resources),
    permissions: manifest.permissions || [],
    requires: connections.requires,
    optional: connections.optional,
    hooks: connections.hooks,
    events: connections.events,
    secrets: manifest.secrets || [],
    approval: manifest.approval || null,
    customization: manifest.customization || null,
    docs,
    migrations: await listRelativeFiles(modulePath, "migrations", ".sql")
  };
}

async function templateRegistryEntry(rootPath, templatePath) {
  const manifest = readJson(join(templatePath, "microservices.template.json"));
  const lock = readJsonOptional(join(templatePath, "microservices.lock.json"), { modules: [] });
  const packageJson = readJsonOptional(join(templatePath, "package.json"), {});

  return {
    id: manifest.id,
    name: manifest.displayName || manifest.name || titleCase(manifest.id),
    version: manifest.version || "0.0.0",
    status: manifest.status || "draft",
    category: manifest.category || "template",
    summary: manifest.summary || "",
    package: packageJson.name || `@microservices-sh/template-${manifest.id}`,
    path: relativeToRoot(rootPath, templatePath),
    manifestPath: relativeToRoot(rootPath, join(templatePath, "microservices.template.json")),
    runtime: manifest.runtime || {},
    deployment: manifest.deployment || {},
    requiredModules: manifest.modules?.required || [],
    optionalModules: manifest.modules?.optional || [],
    activeModules: moduleIdsFromTemplate(manifest),
    slots: manifest.slots || {},
    lockModules: Array.isArray(lock.modules) ? lock.modules.map((module) => ({ id: module.id, version: module.version, source: module.source })) : [],
    sourcePolicy: manifest.sourcePolicy || null,
    docs: {
      readme: existsSync(join(templatePath, "README.md")) ? "README.md" : null,
      agent: existsSync(join(templatePath, "README.agent.md")) ? "README.agent.md" : null,
      llms: existsSync(join(templatePath, "docs/llms.txt")) ? "docs/llms.txt" : null,
      apiBoundary: existsSync(join(templatePath, "docs/api-boundary.md")) ? "docs/api-boundary.md" : null
    },
    migrations: await listRelativeFiles(templatePath, "migrations", ".sql")
  };
}

async function discoverWorkspace(rootPath) {
  const moduleDirectories = await listDirectories(join(rootPath, "modules"));
  const templateDirectories = await listDirectories(join(rootPath, "templates"));
  const modules = [];
  const templates = [];

  for (const modulePath of moduleDirectories) {
    if (existsSync(join(modulePath, "module.json"))) {
      modules.push(await moduleRegistryEntry(rootPath, modulePath));
    }
  }

  for (const templatePath of templateDirectories) {
    if (existsSync(join(templatePath, "microservices.template.json"))) {
      templates.push(await templateRegistryEntry(rootPath, templatePath));
    }
  }

  modules.sort((a, b) => a.id.localeCompare(b.id));
  templates.sort((a, b) => a.id.localeCompare(b.id));

  return {
    root: rootPath,
    modules,
    templates
  };
}

function registryCatalog(workspace) {
  return {
    schemaVersion: "2026-06-13",
    generatedAt: new Date().toISOString(),
    source: {
      type: "workspace",
      root: workspace.root
    },
    counts: {
      modules: workspace.modules.length,
      templates: workspace.templates.length
    },
    modules: workspace.modules,
    templates: workspace.templates
  };
}

async function writeRegistryFiles(outputPath, workspace) {
  const modulesPath = join(outputPath, "modules.json");
  const templatesPath = join(outputPath, "templates.json");
  const catalogPath = join(outputPath, "catalog.json");
  const catalog = registryCatalog(workspace);

  await mkdir(outputPath, { recursive: true });
  await writeFile(modulesPath, json({ schemaVersion: catalog.schemaVersion, generatedAt: catalog.generatedAt, modules: workspace.modules }));
  await writeFile(templatesPath, json({ schemaVersion: catalog.schemaVersion, generatedAt: catalog.generatedAt, templates: workspace.templates }));
  await writeFile(catalogPath, json(catalog));

  return {
    outputPath,
    files: [modulesPath, templatesPath, catalogPath],
    catalog
  };
}

async function runRegistry({ scope, flags }) {
  const rootPath = findWorkspaceRoot(process.cwd());
  if (scope !== "build") {
    failCheck("registry:scope", `Unknown registry command: ${scope}`);
  }

  const workspace = await discoverWorkspace(rootPath);
  const outputPath = flags.out ? resolveFromCwd(flags.out) : join(rootPath, ".generated", "registry");
  const result = await writeRegistryFiles(outputPath, workspace);

  return {
    registry: {
      outputPath: relativeToRoot(rootPath, result.outputPath),
      files: result.files.map((file) => relativeToRoot(rootPath, file)),
      counts: result.catalog.counts
    }
  };
}

function packageModuleDependencies(packageJson, modulePackages) {
  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };

  return Object.entries(dependencies)
    .filter(([name]) => modulePackages.has(name))
    .map(([name, version]) => ({ package: name, version }))
    .sort((a, b) => a.package.localeCompare(b.package));
}

function discoverApp(targetPath, workspace) {
  const lock = readJsonOptional(join(targetPath, "microservices.lock.json"), null);
  const config = readJsonOptional(join(targetPath, "microservices.config.json"), null);
  const templateManifest = readJsonOptional(join(targetPath, "microservices.template.json"), null);
  const packageJson = readJsonOptional(join(targetPath, "package.json"), {});
  const moduleById = new Map(workspace.modules.map((module) => [module.id, module]));
  const modulePackages = new Set(workspace.modules.map((module) => module.package).filter(Boolean));
  const lockModules = Array.isArray(lock?.modules) ? lock.modules : [];
  const packageModules = packageModuleDependencies(packageJson, modulePackages);

  if (!lock && !config && !templateManifest && packageModules.length === 0) {
    return null;
  }

  const installedModules = lockModules.map((locked) => {
    const registryModule = moduleById.get(locked.id);
    const dependency = registryModule
      ? packageModules.find((item) => item.package === registryModule.package)
      : null;
    let status = "unknown";

    if (!registryModule) {
      status = "not-in-local-registry";
    } else if (locked.version === registryModule.version) {
      status = "current";
    } else {
      status = "version-drift";
    }

    return {
      id: locked.id,
      lockedVersion: locked.version || null,
      localRegistryVersion: registryModule?.version || null,
      status,
      source: locked.source || null,
      package: registryModule?.package || null,
      dependencyVersion: dependency?.version || null,
      missingDependency: Boolean(registryModule?.package && !dependency),
      permissions: registryModule?.permissions || locked.contract?.permissions || [],
      resources: registryModule?.resources || locked.contract?.resources || [],
      hooks: registryModule?.hooks || locked.contract?.hooks || [],
      secrets: registryModule?.secrets || []
    };
  });

  const dependencyOnlyModules = packageModules
    .filter((dependency) => !installedModules.some((module) => module.package === dependency.package))
    .map((dependency) => ({
      package: dependency.package,
      dependencyVersion: dependency.version,
      status: "dependency-without-lock-entry"
    }));

  const warnings = [];
  if (!lock) warnings.push("No microservices.lock.json found; module version state is inferred only from package dependencies.");
  if (installedModules.some((module) => module.status === "version-drift")) {
    warnings.push("One or more locked modules differ from the local registry version.");
  }
  if (installedModules.some((module) => module.missingDependency)) {
    warnings.push("One or more locked local modules are missing matching package dependencies.");
  }
  if (dependencyOnlyModules.length > 0) {
    warnings.push("One or more @microservices-sh/<module-id> dependencies are not represented in microservices.lock.json.");
  }

  return {
    path: targetPath,
    hasLockfile: Boolean(lock),
    hasConfig: Boolean(config),
    hasTemplateManifest: Boolean(templateManifest),
    template: lock?.template || (templateManifest ? { id: templateManifest.id, version: templateManifest.version } : null),
    installedModules,
    packageModuleDependencies: packageModules,
    dependencyOnlyModules,
    warnings
  };
}

async function runDiscover({ flags }) {
  const rootPath = findWorkspaceRoot(process.cwd());
  const targetPath = flags.path ? resolveFromCwd(flags.path) : process.cwd();
  const workspace = await discoverWorkspace(rootPath);
  const app = discoverApp(targetPath, workspace);

  return {
    discovery: {
      mode: "read-only",
      workspace: {
        root: relativeToRoot(rootPath, rootPath),
        moduleCount: workspace.modules.length,
        templateCount: workspace.templates.length,
        modules: workspace.modules,
        templates: workspace.templates
      },
      app,
      recommendations: [
        "Use registry build before publishing SDK, CLI, MCP, or create-app metadata.",
        "Use discover output to produce integration plans; do not auto-apply module changes without approval.",
        "Require explicit approval for secrets, webhooks, migrations, Cloudflare resources, and provider side effects."
      ]
    }
  };
}

// The SvelteKit project shims (templates/*/scripts/microservices.js and the
// create-app bundled shim) are the SAME script. They drifted because updates
// only landed in some copies. They are now generated from a single canonical
// template; the only per-target variation is the template id + display name.
// Template-specific `check` file lists live in each microservices.template.json
// `checks: [{id,file}]` (read by the shim), NOT in the shim code, so even
// templates with different check sets share one canonical.
// Edit shims/sveltekit-shim.template.js, then run `shims sync`.
const SHIM_TEMPLATE_PATH = "packages/workspace-tools/shims/sveltekit-shim.template.js";
const SHIM_TARGETS = [
  { id: "booking-sveltekit", name: "Booking SvelteKit", path: "templates/booking-sveltekit/scripts/microservices.js" },
  { id: "saas-starter-sveltekit", name: "SaaS Starter SvelteKit", path: "templates/saas-starter-sveltekit/scripts/microservices.js" },
  { id: "client-portal-sveltekit", name: "Client Portal SvelteKit", path: "templates/client-portal-sveltekit/scripts/microservices.js" },
  // Bundled shim consumed by create-microservices-app framework-starter for new
  // framework apps. Kept identical to booking to preserve current behavior.
  { id: "booking-sveltekit", name: "Booking SvelteKit", path: "packages/create-microservices-app/shim/microservices.js" }
];

function renderShim(template, target) {
  return template
    .split("__MS_TEMPLATE_NAME__").join(target.name)
    .split("__MS_TEMPLATE_ID__").join(target.id);
}

async function runShims({ scope, flags }) {
  const mode = scope || "check";
  if (!["sync", "check"].includes(mode)) {
    failCheck("shims:scope", `Unknown shims command: ${mode}. Use "shims sync" or "shims check".`);
  }

  const rootPath = findWorkspaceRoot(process.cwd());
  const templatePath = join(rootPath, SHIM_TEMPLATE_PATH);
  if (!existsSync(templatePath)) {
    failCheck("shims:template", `Canonical shim template not found: ${SHIM_TEMPLATE_PATH}`);
  }
  const template = readText(templatePath);

  const results = [];
  for (const target of SHIM_TARGETS) {
    const absolute = join(rootPath, target.path);
    const expected = renderShim(template, target);
    const actual = existsSync(absolute) ? readText(absolute) : null;
    const inSync = actual === expected;

    if (mode === "sync" && !inSync) {
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, expected);
    }

    results.push({
      id: target.id,
      path: relativeToRoot(rootPath, absolute),
      status: mode === "sync" ? (inSync ? "unchanged" : "written") : (inSync ? "in-sync" : "drift")
    });
  }

  const drifted = results.filter((result) => result.status === "drift");
  if (mode === "check" && drifted.length > 0) {
    const list = drifted.map((result) => result.path).join(", ");
    failCheck("shims:drift", `Shim(s) out of sync with ${SHIM_TEMPLATE_PATH}: ${list}. Run "pnpm sync:shims".`);
  }

  return { shims: { mode, template: SHIM_TEMPLATE_PATH, targets: results } };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "help") {
    process.stdout.write(usage());
    return;
  }

  if (parsed.command === "scaffold") {
    const data = await runScaffold(parsed);

    if (parsed.flags.json) {
      writeJson({ ok: true, data });
      return;
    }

    process.stdout.write(`${data.scaffolded.kind} scaffolded: ${data.scaffolded.path}\n`);
    for (const command of data.scaffolded.nextCommands) {
      process.stdout.write(`next: ${command}\n`);
    }
    return;
  }

  if (parsed.command === "registry") {
    const data = await runRegistry(parsed);

    if (parsed.flags.json) {
      writeJson({ ok: true, data });
      return;
    }

    process.stdout.write(`registry built: ${data.registry.outputPath}\n`);
    for (const file of data.registry.files) {
      process.stdout.write(`wrote: ${file}\n`);
    }
    return;
  }

  if (parsed.command === "shims") {
    const data = await runShims(parsed);

    if (parsed.flags.json) {
      writeJson({ ok: true, data });
      return;
    }

    for (const target of data.shims.targets) {
      process.stdout.write(`${target.status}: ${target.path}\n`);
    }
    process.stdout.write(`shims ${data.shims.mode} ok (${data.shims.targets.length} target${data.shims.targets.length === 1 ? "" : "s"})\n`);
    return;
  }

  if (parsed.command === "discover") {
    const data = await runDiscover(parsed);

    if (parsed.flags.json) {
      writeJson({ ok: true, data });
      return;
    }

    process.stdout.write(`discovered ${data.discovery.workspace.moduleCount} module(s) and ${data.discovery.workspace.templateCount} template(s)\n`);
    if (data.discovery.app) {
      process.stdout.write(`app modules: ${data.discovery.app.installedModules.map((module) => `${module.id}:${module.status}`).join(", ") || "none"}\n`);
      for (const warning of data.discovery.app.warnings) {
        process.stdout.write(`warning: ${warning}\n`);
      }
    }
    return;
  }

  if (parsed.command !== "check") {
    failCheck("command:name", `Unknown command: ${parsed.command}`);
  }

  const data = await runCheck(parsed);

  if (parsed.flags.json) {
    writeJson({ ok: true, data });
    return;
  }

  for (const result of data.checked) {
    process.stdout.write(`${result.kind} check passed: ${result.path}\n`);
  }
  process.stdout.write(`workspace spec check passed (${data.checked.length} target${data.checked.length === 1 ? "" : "s"})\n`);
}

// Only run the CLI when invoked directly (not when imported, e.g. by tests).
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectRun) {
  main().catch((error) => {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.flags.json) {
      writeJson({
        ok: false,
        error: {
          code: "CHECK_FAILED",
          checkId: error.checkId || null,
          message: error.message
        }
      });
    } else {
      process.stderr.write(`${error.message}\n`);
    }
    process.exit(1);
  });
}
