import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: resolve(testDir, "../../.."),
    encoding: "utf8",
    env: {
      ...process.env,
      MICROSERVICES_CONFIG_PATH: resolve(testDir, "__missing-config.json"),
      MICROSERVICES_TELEMETRY: "0",
    },
  });
}

function parseStdout(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON stdout: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

describe("CLI structured errors", () => {
  it("returns JSON for missing required deployment ids", () => {
    const result = runCli(["deploy", "status", "--json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatchObject({
      code: "DEPLOYMENT_ID_REQUIRED",
      message: "Missing deployment id.",
    });
  });

  it("rejects flags that are missing values before they consume the next flag", () => {
    const result = runCli(["deploy", "status", "--api-url", "--json"]);
    expect(result.status).toBe(1);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatchObject({
      code: "CLI_FLAG_VALUE_REQUIRED",
      details: { option: "--api-url" },
    });
  });

  it("returns structured API reachability failures", () => {
    const result = runCli(["billing", "plans", "--api-url", "http://127.0.0.1:9", "--json"]);
    // API/business failures are represented in JSON; existing CLI behavior does
    // not force every remote ok:false payload to a non-zero process exit.
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatchObject({
      code: "API_UNREACHABLE",
    });
  });
});
