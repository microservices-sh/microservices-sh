import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

const ACCOUNT_BILLING_ROUTES = {
  "/billing/plans": { ok: true, data: [{ id: "starter", label: "Starter" }] },
  "/billing/status": { ok: true, data: { planId: "starter", status: "active" } },
  "/usage": { ok: true, data: { items: [{ label: "Deployments", used: 1, limit: 3 }] } },
};

const ACCOUNT_BILLING_COMMANDS = [
  ["plans", "/billing/plans"],
  ["status", "/billing/status"],
  ["usage", "/usage"],
];

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      MICROSERVICES_TELEMETRY: "0",
    },
  });
}

function parseStdout(result) {
  return JSON.parse(result.stdout);
}

function runCliAsync(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MICROSERVICES_TELEMETRY: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}\nstdout:${stdout}\nstderr:${stderr}`));
    }, 5000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

async function withApiServer(routes, fn) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    const payload = routes[request.url];
    response.setHeader("content-type", "application/json");
    if (!payload) {
      response.statusCode = 404;
      response.end(JSON.stringify({ ok: false, error: { message: `No route for ${request.url}` } }));
      return;
    }
    response.end(JSON.stringify(payload));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function expectBillingRoute(commandPrefix) {
  await withApiServer(ACCOUNT_BILLING_ROUTES, async (apiUrl, requests) => {
    for (const [command, expectedPath] of ACCOUNT_BILLING_COMMANDS) {
      const result = await runCliAsync([...commandPrefix, command, "--api-url", apiUrl, "--api-key", "test-key", "--json"]);
      const payload = parseStdout(result);
      expect(result.status).toBe(0);
      expect(payload.ok).toBe(true);
      expect(requests.at(-1)).toMatchObject({
        method: "GET",
        url: expectedPath,
        authorization: "Bearer test-key",
      });
    }
  });
}

describe("CLI account billing commands", () => {
  it("documents account billing as the canonical platform billing command", () => {
    const result = runCli(["help", "all"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("microservices account billing status");
    expect(result.stdout).toContain("microservices billing plans");
    expect(result.stdout).toContain("alias for account billing");
  });

  it("routes account billing actions to platform billing API endpoints", async () => {
    await expectBillingRoute(["account", "billing"]);
  });

  it("routes legacy billing aliases to the same platform billing API endpoints", async () => {
    await expectBillingRoute(["billing"]);
  });

  it("routes account billing errors through the account billing command surface", () => {
    const result = runCli(["account", "billing", "unknown", "--json"]);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNKNOWN_ACCOUNT_BILLING_COMMAND");
    expect(payload.error.remediation).toContain("microservices account billing status");
  });

  it("keeps the legacy billing command as an account billing alias", () => {
    const result = runCli(["billing", "unknown", "--json"]);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNKNOWN_BILLING_COMMAND");
    expect(payload.error.remediation).toContain("microservices billing status");
  });
});
