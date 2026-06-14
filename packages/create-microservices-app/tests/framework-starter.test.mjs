import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFrameworks, resolveFramework, buildC3Command, applyFrameworkHook, frameworkNextSteps } from "../src/framework-starter.js";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("loadFrameworks returns the six v1 rows", () => {
  const rows = loadFrameworks();
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.id && r.c3Framework && r.hookEntry));
});

test("resolveFramework finds by id, null when absent", () => {
  assert.equal(resolveFramework("nextjs").c3Framework, "next");
  assert.equal(resolveFramework("does-not-exist"), null);
});

test("buildC3Command maps package managers to C3 invocation", () => {
  const row = { c3Framework: "next" };
  assert.deepEqual(buildC3Command("npm", row, "my-app"), {
    cmd: "npm",
    args: ["create", "cloudflare@latest", "my-app", "--", "--framework=next", "--no-deploy", "--no-git", "--no-open"],
  });
  assert.deepEqual(buildC3Command("pnpm", row, "my-app").args[0], "create");
  assert.equal(buildC3Command("bun", row, "my-app").cmd, "bunx");
});

test("applyFrameworkHook injects config, readme, shim + script; tolerates missing hookEntry", () => {
  const dir = mkdtempSync(join(tmpdir(), "fw-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: {} }));
  const row = { id: "nextjs", label: "Next.js", hookEntry: "app/layout.tsx", adapter: "@opennextjs/cloudflare" };

  applyFrameworkHook(dir, row, "npm"); // hookEntry absent -> must not throw

  assert.ok(existsSync(join(dir, "microservices.config.json")));
  const cfg = JSON.parse(readFileSync(join(dir, "microservices.config.json"), "utf8"));
  assert.deepEqual(cfg.modules, []);
  assert.match(readFileSync(join(dir, "README.microservices.md"), "utf8"), /microservices -- add/);
  assert.ok(existsSync(join(dir, "scripts/microservices.js")), "shim vendored");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.scripts.microservices, "node scripts/microservices.js");
});

test("applyFrameworkHook appends banner when hookEntry exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "fw-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: {} }));
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app/layout.tsx"), "export default function L(){}");
  applyFrameworkHook(dir, { id: "nextjs", hookEntry: "app/layout.tsx", label: "Next.js" }, "npm");
  assert.match(readFileSync(join(dir, "app/layout.tsx"), "utf8"), /microservices\.sh/);
});

test("frameworkNextSteps lists cd, dev, and project-local add command", () => {
  const lines = frameworkNextSteps("npm", "my-app", { devCommand: "dev", label: "Next.js" });
  assert.ok(lines.includes("cd my-app"));
  assert.ok(lines.some((l) => l.includes("npm run dev")));
  assert.ok(lines.some((l) => l.includes("npm run microservices -- add")));
});
