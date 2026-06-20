import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCli(args) {
  return new Promise((resolveRun, rejectRun) => {
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
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`CLI command timed out: ${args.join(" ")}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 10000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

function parseStdout(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON stdout: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

async function withApiServer(handler, fn) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    request.setEncoding("utf8");
    for await (const chunk of request) body += chunk;
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body: body ? JSON.parse(body) : null,
    });
    const payload = await handler(request, body);
    response.statusCode = payload.status ?? 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload.body));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

describe("CLI Hermes agent commands", () => {
  it("renders a BYO Fly setup plan without API credentials", async () => {
    const result = await runCli([
      "agents",
      "hermes",
      "setup",
      "--mode",
      "byo-fly",
      "--app",
      "acme-hermes",
      "--org",
      "acme",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(true);
    expect(payload.data).toMatchObject({
      mode: "byo-fly",
      target: {
        app: "acme-hermes",
        org: "acme",
      },
    });
    expect(payload.data.commands.join("\n")).toContain("fly apps create acme-hermes --org acme");
  });

  it("routes hosted plan and create through the authenticated API", async () => {
    await withApiServer(async (request) => {
      if (request.method === "POST" && request.url === "/agents/hermes/runtimes/plan") {
        return {
          body: {
            ok: true,
            data: {
              mode: "hosted",
              provider: "fly",
              allowed: false,
              access: {
                paymentRequired: true,
                planId: "free",
                billingStatus: "none",
                quota: { key: "hosted_hermes_runtimes", used: 0, limit: 0 },
              },
              target: { appName: "ms-hermes-test", region: "iad" },
              nextSteps: ["Complete payment."],
            },
          },
        };
      }
      if (request.method === "POST" && request.url === "/agents/hermes/runtimes") {
        return {
          status: 402,
          body: {
            ok: false,
            error: {
              code: "PAYMENT_REQUIRED",
              message: "Hosted Hermes requires payment.",
              remediation: "Complete checkout.",
            },
          },
        };
      }
      return { status: 404, body: { ok: false, error: { message: `No route for ${request.url}` } } };
    }, async (apiUrl, requests) => {
      const plan = await runCli([
        "agents",
        "hermes",
        "plan",
        "--mode",
        "hosted",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(plan.status).toBe(0);
      expect(parseStdout(plan).data.access.paymentRequired).toBe(true);
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/agents/hermes/runtimes/plan",
        authorization: "Bearer test-key",
      });

      const create = await runCli([
        "agents",
        "hermes",
        "create",
        "--mode",
        "hosted",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(create.status).toBe(0);
      expect(parseStdout(create).error.code).toBe("PAYMENT_REQUIRED");
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/agents/hermes/runtimes",
        authorization: "Bearer test-key",
      });
    });
  });

  it("emits the ops read-back provisioning commands from the runtime's grant", async () => {
    await withApiServer(async (request) => {
      if (request.method === "GET" && request.url === "/agents/hermes/runtimes/arun_1/ops-grant") {
        return {
          body: {
            ok: true,
            data: {
              grant: { ownerId: "ws_acme", scopes: ["ops.invoice.read"], secret: "tenant-secret", expiresAt: 1_750_000_000_000 },
              target: { hermesApp: "acme-hermes", operateApp: null },
            },
          },
        };
      }
      return { status: 404, body: { ok: false, error: { message: `No route for ${request.url}` } } };
    }, async (apiUrl, requests) => {
      const res = await runCli([
        "agents",
        "hermes",
        "ops-credentials",
        "arun_1",
        "--operate-app",
        "acme-operate",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(res.status).toBe(0);
      const payload = parseStdout(res);
      expect(payload.ok).toBe(true);
      expect(payload.data.plan.opsToken).toBeTruthy();
      expect(payload.data.plan.hermesSecretCommand).toContain("fly secrets set OPS_TOKEN=");
      expect(payload.data.plan.hermesSecretCommand).toContain("-a acme-hermes");
      expect(payload.data.plan.operateSecretCommand).toContain("OPS_VERIFY_SECRET");
      expect(payload.data.plan.operateSecretCommand).toContain("acme-operate");
      expect(requests.at(-1)).toMatchObject({
        method: "GET",
        url: "/agents/hermes/runtimes/arun_1/ops-grant",
        authorization: "Bearer test-key",
      });
    });
  });

  it("requires --operate-app to emit the verify-secret command", async () => {
    await withApiServer(async (request) => {
      if (request.method === "GET" && request.url === "/agents/hermes/runtimes/arun_1/ops-grant") {
        return {
          body: {
            ok: true,
            data: {
              grant: { ownerId: "ws_acme", scopes: ["ops.invoice.read"], secret: "tenant-secret", expiresAt: 1_750_000_000_000 },
              target: { hermesApp: "acme-hermes", operateApp: null },
            },
          },
        };
      }
      return { status: 404, body: { ok: false, error: { message: `No route for ${request.url}` } } };
    }, async (apiUrl) => {
      const res = await runCli([
        "agents",
        "hermes",
        "ops-credentials",
        "arun_1",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      const payload = parseStdout(res);
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("HERMES_OPERATE_APP_REQUIRED");
    });
  });
});
