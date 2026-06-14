#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { generateProject, listModuleDocs, listModules, listTemplates } from "@microservices-sh/sdk-internal";
import { loadFrameworks, resolveFramework, buildC3Command, applyFrameworkHook, frameworkNextSteps } from "./framework-starter.js";

const PACKAGE_VERSION = "0.2.3";
const USER_CWD = process.env.INIT_CWD || process.cwd();

// Repo-style templates bundled into the package (see scripts/build.js). These
// are copied verbatim instead of generated procedurally from module-contract.
const TEMPLATES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "templates");
const REPO_TEMPLATES = {
  "booking-sveltekit": {
    id: "booking-sveltekit",
    name: "Booking SvelteKit",
    status: "ready",
    summary: "Full Cloudflare SvelteKit booking app — public booking flow, admin, D1, typed hooks.",
  },
};
const BUNDLED_MODULES = ["audit-log", "auth", "booking", "customer", "gateway"];

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
    template: "booking-business",
    packageManager: detectPackageManager(),
    install: process.env.CI !== "true",
    json: false,
    config: null,
    dir: USER_CWD,
    modules: null,
    gitRepo: null,
    git: true,
    interactive: false,
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
  pnpm create microservices-app <app-name>

Options:
  --template <id>              Template id. Default: booking-business
                               (booking-business = Cloudflare Worker / Hono;
                                booking-sveltekit = full Cloudflare SvelteKit app)
  --modules <ids>              Comma-separated extra module ids to enable
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
    (!targetName && !flags.json && process.env.CI !== "true" && process.stdin.isTTY && process.stdout.isTTY)
  );
}

function csv(value) {
  const text = String(value ?? "").trim();
  if (!text || /^(default|template-defaults|none|no|skip)$/i.test(text)) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
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
      const answer = await ask("Project name: ");
      nextTargetName = answer.trim();
    }

    if (!nextTargetName) {
      throw new Error("Project name is required.");
    }

    if (!flags.explicit.template) {
      const availableTemplates = availableTemplateList();
      printChoices("Templates", availableTemplates);
      const answer = await ask(`Template number or id [${nextFlags.template}]: `);
      nextFlags.template = resolveChoice(answer, availableTemplates, nextFlags.template, "template");
    }

    if (!flags.explicit.modules) {
      const docs = listModuleDocs();
      const availableModules = docs.ok ? docs.data : modules.ok ? modules.data : [];
      printChoices("Modules", availableModules);
      const answer = await ask(
        "Extra modules to enable or plan, numbers or ids comma-separated [template defaults]: "
      );
      nextFlags.modules = resolveChoices(answer, availableModules, "module");
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
  const available = modules.ok ? modules.data.map((module) => module.id) : [];
  const known = docs.ok ? docs.data.map((module) => module.id) : available;
  const generationModules = moduleIds.filter((moduleId) => available.includes(moduleId));
  const planOnlyModules = moduleIds.filter((moduleId) => known.includes(moduleId) && !available.includes(moduleId));
  const unknown = moduleIds.filter((moduleId) => !known.includes(moduleId));

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

function nextCommands(packageManager, appName, installed, planOnlyModules = [], templateId = "booking-business") {
  const installLine = installed ? null : `${packageManager} install`;
  const isSvelteKitTemplate = templateId === "booking-sveltekit";
  const microservices = (args) => packageScriptCommand(packageManager, "microservices", args);
  const localSetup = isSvelteKitTemplate ? [microservices(["local", "setup"])] : [];
  const deployPlan = isSvelteKitTemplate ? [microservices(["deploy", "preview", "--plan"])] : [];
  const devCommand = packageScriptCommand(packageManager, "dev");
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

  if (parsed.targetName === "help") {
    process.stdout.write(usage());
    return;
  }

  const guided = await askGuidedSetup(parsed.targetName, parsed.flags);
  const { targetName, flags } = guided;

  if (!targetName) {
    process.stdout.write(usage());
    return;
  }

  const appName = slugify(targetName);
  const targetDirectory = resolve(flags.dir, appName);
  await assertEmptyOrMissing(targetDirectory);

  const isRepoTemplate = Boolean(REPO_TEMPLATES[flags.template]);
  const allTemplates = availableTemplateList();
  if (!allTemplates.some((template) => template.id === flags.template)) {
    const response = fail(
      "TEMPLATE_NOT_FOUND",
      `Unknown template: ${flags.template}`,
      "Run with --template set to an available template id.",
      { available: allTemplates.map((template) => template.id) }
    );
    return flags.json ? writeJson(response) : process.stderr.write(`Error: ${response.error.message}\n`);
  }

  const frameworkRow = resolveFramework(flags.template);
  if (frameworkRow) {
    const { cmd, args } = buildC3Command(flags.packageManager, frameworkRow, appName);
    const result = spawnSync(cmd, args, { stdio: "inherit", cwd: USER_CWD });
    if (result.status !== 0) {
      process.stderr.write(`\nC3 scaffold failed (exit ${result.status}). See output above.\n`);
      process.exit(result.status ?? 1);
    }
    const appDir = resolve(USER_CWD, appName);
    applyFrameworkHook(appDir, frameworkRow, flags.packageManager);
    process.stdout.write("\nNext steps:\n" + frameworkNextSteps(flags.packageManager, appName, frameworkRow).map((l) => `  ${l}`).join("\n") + "\n");
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
      return flags.json ? writeJson(response) : process.stderr.write(`Error: ${response.error.message}\n`);
    }
    generatedFiles = response.data.files;
    generatedModules = response.data.composition.modules.map((module) => module.id);
    planOnlyModules = selection.planOnlyModules;
    selectionWarnings = selection.warnings;
  }

  const { root, written } = await writeGeneratedFiles(targetDirectory, generatedFiles);
  const git = setupGit(root, flags.git ? flags.gitRepo : null);
  let installResult = null;

  if (flags.install) {
    installResult = installDependencies(root, flags.packageManager);
    if ((installResult.status ?? 1) !== 0) {
      const output = fail(
        "INSTALL_FAILED",
        "Project files were written, but dependency installation failed.",
        `Run cd ${appName} and ${flags.packageManager} install.`,
        { appName, packageManager: flags.packageManager, root }
      );
      return flags.json ? writeJson(output) : process.stderr.write(`\n${output.error.message}\nNext: ${output.error.remediation}\n`);
    }
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
    },
    warnings: [
      ...selectionWarnings,
      ...(flags.install ? [] : ["Dependencies were not installed. Run the install command before local dev."]),
    ],
  };

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
}

main().catch((error) => {
  const response = fail("CREATE_APP_FAILED", error.message, "Fix the input or choose an empty target directory.");
  writeJson(response);
  process.exitCode = 1;
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Kept for bin-entry clarity; main is already invoked above.
}
