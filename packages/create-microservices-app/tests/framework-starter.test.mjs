import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFrameworks, resolveFramework } from "../src/framework-starter.js";
import { buildC3Command } from "../src/framework-starter.js";

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
