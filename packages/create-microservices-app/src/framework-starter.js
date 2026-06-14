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
