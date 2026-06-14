import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFrameworks, resolveFramework } from "../src/framework-starter.js";

test("loadFrameworks returns the six v1 rows", () => {
  const rows = loadFrameworks();
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.id && r.c3Framework && r.hookEntry));
});

test("resolveFramework finds by id, null when absent", () => {
  assert.equal(resolveFramework("nextjs").c3Framework, "next");
  assert.equal(resolveFramework("does-not-exist"), null);
});
