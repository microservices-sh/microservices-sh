import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCliSync(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      MICROSERVICES_TELEMETRY: "0",
    },
  });
}

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
    const payload = await handler(request);
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

const SOURCE = {
  id: "memsrc_1",
  provider: "github",
  repoUrl: "https://github.com/acme/auth-kit",
  repoOwner: "acme",
  repoName: "auth-kit",
  repoVisibility: "public",
  allowedPaths: ["src/auth"],
  scanStatus: "not_scanned",
};

const CAPSULE = {
  id: "memcap_1",
  sourceId: "memsrc_1",
  slug: "stripe-webhook-verifier",
  name: "Stripe webhook verifier",
  purpose: "Verify Stripe webhook signatures before parsing request JSON.",
  sourcePath: "src/billing/webhooks.ts",
  files: ["src/billing/webhooks.ts"],
  tests: ["test/billing/webhooks.test.ts"],
  dependencies: ["stripe"],
  requiredEnv: ["STRIPE_WEBHOOK_SECRET"],
  constraints: ["Do not parse JSON before signature verification."],
  reuseMode: "adapt",
  approvalStatus: "candidate",
  visibility: "workspace_private",
  provenance: {
    repoUrl: "https://github.com/acme/auth-kit",
    path: "src/billing/webhooks.ts",
    ref: "main",
  },
};

describe("CLI Code Memory commands", () => {
  it("documents memory commands in help all", () => {
    const result = runCliSync(["help", "all"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("microservices memory source add");
    expect(result.stdout).toContain("microservices memory source scan");
    expect(result.stdout).toContain("microservices memory capsule create");
    expect(result.stdout).toContain("microservices memory approve");
    expect(result.stdout).toContain("microservices memory reject");
    expect(result.stdout).toContain("microservices memory search");
  });

  it("adds and lists Trusted Sources through the API", async () => {
    await withApiServer(async (request) => {
      if (request.method === "POST" && request.url === "/memory/sources") {
        return { status: 201, body: { ok: true, data: { source: SOURCE, sourceVersion: { id: "memver_1" } } } };
      }
      if (request.method === "GET" && request.url === "/memory/sources?limit=10") {
        return { body: { ok: true, data: { sources: [SOURCE] } } };
      }
      if (request.method === "POST" && request.url === "/memory/sources/memsrc_1/scan") {
        return {
          body: {
            ok: true,
            data: {
              source: SOURCE,
              sourceVersion: { id: "memver_1", ref: "main" },
              candidates: [CAPSULE],
              scanned: { ref: "main", fileCount: 4, candidateCount: 1, truncated: false },
              nextSteps: ["Review candidate Logic Capsules before approving them for agent reuse."],
            },
          },
        };
      }
      return { status: 404, body: { ok: false, error: { message: `No route for ${request.url}` } } };
    }, async (apiUrl, requests) => {
      const add = await runCli([
        "memory",
        "source",
        "add",
        "https://github.com/Acme/auth-kit/tree/main/src/auth",
        "--visibility",
        "public",
        "--path",
        "src/auth",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(add.status).toBe(0);
      expect(parseStdout(add).ok).toBe(true);
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/memory/sources",
        authorization: "Bearer test-key",
        body: {
          repoUrl: "https://github.com/Acme/auth-kit/tree/main/src/auth",
          repoVisibility: "public",
          path: "src/auth",
        },
      });

      const list = await runCli([
        "memory",
        "source",
        "list",
        "--limit",
        "10",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(list.status).toBe(0);
      expect(parseStdout(list).data.sources).toHaveLength(1);
      expect(requests.at(-1)).toMatchObject({
        method: "GET",
        url: "/memory/sources?limit=10",
        authorization: "Bearer test-key",
      });

      const scan = await runCli([
        "memory",
        "source",
        "scan",
        "memsrc_1",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(scan.status).toBe(0);
      expect(parseStdout(scan).data.scanned.candidateCount).toBe(1);
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/memory/sources/memsrc_1/scan",
        authorization: "Bearer test-key",
      });
    });
  });

  it("creates, searches, and retrieves Logic Capsules through the API", async () => {
    await withApiServer(async (request) => {
      if (request.method === "POST" && request.url === "/memory/capsules") {
        return { status: 201, body: { ok: true, data: { capsule: CAPSULE } } };
      }
      if (request.method === "GET" && request.url === "/memory/capsules?q=stripe&limit=5") {
        return { body: { ok: true, data: { capsules: [CAPSULE] } } };
      }
      if (request.method === "GET" && request.url === "/memory/capsules/stripe-webhook-verifier") {
        return { body: { ok: true, data: { capsule: { ...CAPSULE, approvalStatus: "approved" } } } };
      }
      if (request.method === "POST" && request.url === "/memory/capsules/stripe-webhook-verifier/approve") {
        return { body: { ok: true, data: { capsule: { ...CAPSULE, approvalStatus: "approved" } } } };
      }
      if (request.method === "POST" && request.url === "/memory/capsules/stripe-webhook-verifier/reject") {
        return { body: { ok: true, data: { capsule: { ...CAPSULE, approvalStatus: "rejected" } } } };
      }
      return { status: 404, body: { ok: false, error: { message: `No route for ${request.url}` } } };
    }, async (apiUrl, requests) => {
      const created = await runCli([
        "memory",
        "capsule",
        "create",
        "--source",
        "memsrc_1",
        "--name",
        "Stripe webhook verifier",
        "--purpose",
        "Verify Stripe webhook signatures before parsing request JSON.",
        "--slug",
        "stripe-webhook-verifier",
        "--path",
        "src/billing/webhooks.ts",
        "--files",
        "src/billing/webhooks.ts",
        "--tests",
        "test/billing/webhooks.test.ts",
        "--required-env",
        "STRIPE_WEBHOOK_SECRET",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(created.status).toBe(0);
      expect(parseStdout(created).data.capsule.slug).toBe("stripe-webhook-verifier");
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/memory/capsules",
        authorization: "Bearer test-key",
        body: {
          sourceId: "memsrc_1",
          slug: "stripe-webhook-verifier",
          name: "Stripe webhook verifier",
          sourcePath: "src/billing/webhooks.ts",
          files: ["src/billing/webhooks.ts"],
          tests: ["test/billing/webhooks.test.ts"],
          requiredEnv: ["STRIPE_WEBHOOK_SECRET"],
        },
      });

      const search = await runCli([
        "memory",
        "search",
        "stripe",
        "--limit",
        "5",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(search.status).toBe(0);
      expect(parseStdout(search).data.capsules).toHaveLength(1);
      expect(requests.at(-1)).toMatchObject({
        method: "GET",
        url: "/memory/capsules?q=stripe&limit=5",
      });

      const get = await runCli([
        "code-memory",
        "get",
        "stripe-webhook-verifier",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(get.status).toBe(0);
      expect(parseStdout(get).data.capsule.id).toBe("memcap_1");
      expect(requests.at(-1)).toMatchObject({
        method: "GET",
        url: "/memory/capsules/stripe-webhook-verifier",
      });

      const approve = await runCli([
        "memory",
        "approve",
        "stripe-webhook-verifier",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(approve.status).toBe(0);
      expect(parseStdout(approve).data.capsule.approvalStatus).toBe("approved");
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/memory/capsules/stripe-webhook-verifier/approve",
      });

      const reject = await runCli([
        "memory",
        "capsule",
        "reject",
        "stripe-webhook-verifier",
        "--api-url",
        apiUrl,
        "--api-key",
        "test-key",
        "--json",
      ]);
      expect(reject.status).toBe(0);
      expect(parseStdout(reject).data.capsule.approvalStatus).toBe("rejected");
      expect(requests.at(-1)).toMatchObject({
        method: "POST",
        url: "/memory/capsules/stripe-webhook-verifier/reject",
      });
    });
  });
});
