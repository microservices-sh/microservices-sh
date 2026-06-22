import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../dist/index.js");
const workspaceRoot = resolve(testDir, "../../..");

function runCreate(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      MICROSERVICES_TELEMETRY: "0",
      CI: "true",
    },
  });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON stdout: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

test("create CLI reports missing flag values as structured JSON", () => {
  const result = runCreate(["demo", "--template", "--json"]);
  assert.equal(result.status, 1);
  const payload = parseJson(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "CLI_FLAG_VALUE_REQUIRED");
  assert.equal(payload.error.details.option, "--template");
});

test("create CLI reports invalid config JSON as structured JSON", () => {
  const result = runCreate(["demo", "--config", "{bad}", "--json"]);
  assert.equal(result.status, 1);
  const payload = parseJson(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "CLI_FLAG_VALUE_INVALID");
  assert.equal(payload.error.details.option, "--config");
});
