import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
