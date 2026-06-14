import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "frameworks.json");

export function loadFrameworks() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).frameworks;
}

export function resolveFramework(id) {
  return loadFrameworks().find((row) => row.id === id) ?? null;
}

export function buildC3Command(packageManager, row, appName) {
  const c3Flags = [`--framework=${row.c3Framework}`, "--no-deploy", "--no-git", "--no-open"];
  if (packageManager === "npm") {
    return { cmd: "npm", args: ["create", "cloudflare@latest", appName, "--", ...c3Flags] };
  }
  if (packageManager === "bun") {
    return { cmd: "bunx", args: ["create-cloudflare@latest", appName, ...c3Flags] };
  }
  // pnpm, yarn: forward flags directly, no `--` separator
  return { cmd: packageManager, args: ["create", "cloudflare@latest", appName, ...c3Flags] };
}

const SHIM_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shim", "microservices.js");

function runScript(pm, args) {
  return pm === "npm" ? `npm run microservices ${args}` : `${pm} microservices ${args}`;
}

export function applyFrameworkHook(appDir, row, pm) {
  writeFileSync(
    join(appDir, "microservices.config.json"),
    JSON.stringify({ modules: [], registry: "https://microservices.sh/registry" }, null, 2) + "\n",
  );

  const add = runScript(pm, "add <module>");
  writeFileSync(
    join(appDir, "README.microservices.md"),
    `# Add backend modules\n\nThis is a ${row.label} app on Cloudflare Workers, scaffolded with microservices.sh.\n\n` +
      `Add auth, billing, booking and more:\n\n\`\`\`bash\n${add}\n\`\`\`\n\n` +
      `List available modules:\n\n\`\`\`bash\n${runScript(pm, "modules list")}\n\`\`\`\n`,
  );

  // Vendor the self-contained shim (node-builtins only, no deps) so the
  // project-local `microservices` script resolves with zero install.
  mkdirSync(join(appDir, "scripts"), { recursive: true });
  copyFileSync(SHIM_PATH, join(appDir, "scripts", "microservices.js"));

  const pkgPath = join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts = { ...pkg.scripts, microservices: "node scripts/microservices.js" };
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const entry = join(appDir, row.hookEntry ?? "");
  if (row.hookEntry && existsSync(entry)) {
    appendFileSync(entry, `\n// Powered by microservices.sh — add modules: ${add}\n`);
  }
}
