import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      INIT_CWD: cwd,
      MICROSERVICES_TELEMETRY: "0",
    },
  });
}

function parseStdout(result) {
  return JSON.parse(result.stdout);
}

async function withLock(version, fn) {
  const root = await mkdtemp(join(tmpdir(), "microservices-cli-versioning-"));
  await writeFile(
    join(root, "microservices.lock.json"),
    `${JSON.stringify(
      {
        schemaVersion: "2026-06-13",
        modules: [
          {
            id: "auth",
            version,
            source: `registry:auth@${version}`,
            sourceRef: {
              type: "git",
              repo: "microservices-sh/microservices-sh",
              url: "https://github.com/microservices-sh/microservices-sh.git",
              tag: `modules/auth/v${version}`,
              ref: `refs/tags/modules/auth/v${version}`,
              path: "modules/auth",
            },
            checksum: "sha256:test",
            contract: {},
          },
        ],
        customizations: { config: true, hooks: [], overlays: [], forks: [] },
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("CLI module versioning", () => {
  it("inspects versioned module refs", () => {
    const result = runCli(["modules", "inspect", "auth@0.1.0", "--json"], process.cwd());
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(true);
    expect(payload.data).toMatchObject({ id: "auth", version: "0.1.0" });
  });

  it("plans add with a version flag", () => {
    const result = runCli(["add", "payment", "--version", "0.1.0", "--plan", "--json"], process.cwd());
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(true);
    expect(payload.data.module.id).toBe("payment");
    expect(payload.data.requestedVersion).toBe("0.1.0");
    expect(payload.data.sourceRef).toMatchObject({
      tag: "modules/payment/v0.1.0",
      ref: "refs/tags/modules/payment/v0.1.0",
    });
    expect(payload.data.lockEntry.sourceRef).toMatchObject({
      tag: "modules/payment/v0.1.0",
    });
  });

  it("inspects docs for versioned module refs", () => {
    const result = runCli(["docs", "auth", "--version", "0.1.0", "--json"], process.cwd());
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(true);
    expect(payload.data.module.sourceRef).toMatchObject({
      tag: "modules/auth/v0.1.0",
    });
  });

  it("lists and composes bundled repo-style templates from the root catalog", () => {
    const listed = runCli(["templates", "list", "--json"], process.cwd());
    expect(listed.status).toBe(0);
    const listPayload = parseStdout(listed);
    expect(listPayload.ok).toBe(true);
    expect(listPayload.data.map((template) => template.id)).toEqual(expect.arrayContaining([
      "booking-sveltekit",
      "commerce-ops-sveltekit",
      "accounting-erp-sveltekit",
    ]));

    const composed = runCli(["compose", "commerce-ops-sveltekit", "--json"], process.cwd());
    expect(composed.status).toBe(0);
    const composePayload = parseStdout(composed);
    expect(composePayload.ok).toBe(true);
    expect(composePayload.data.template.id).toBe("commerce-ops-sveltekit");
    expect(composePayload.data.modules.map((module) => module.id)).toEqual(expect.arrayContaining([
      "commerce-sync",
      "sales-order",
      "shipment",
    ]));
  });

  it("refuses root procedural generation for repo-style templates", () => {
    const result = runCli(["generate", "commerce-ops-sveltekit", "--out", "app", "--json"], process.cwd());
    expect(result.status).not.toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("REPO_TEMPLATE_GENERATE_UNSUPPORTED");
    expect(payload.error.remediation).toContain("--template commerce-ops-sveltekit");
  });

  it("rejects conflicting inline and flag versions", () => {
    const result = runCli(["add", "auth@0.1.0", "--version", "9.9.9", "--plan", "--json"], process.cwd());
    const payload = parseStdout(result);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("MODULE_VERSION_CONFLICT");
  });

  it("plans downgrade from a project lockfile", async () => {
    await withLock("0.2.0", async (root) => {
      const result = runCli(["upgrade", "auth", "--to", "0.1.0", "--plan", "--json"], root);
      expect(result.status).toBe(0);
      const payload = parseStdout(result);
      expect(payload.ok).toBe(true);
      expect(payload.data.action).toBe("downgrade-plan");
      expect(payload.data.lockfile.targetSourceRef).toMatchObject({
        tag: "modules/auth/v0.1.0",
      });
    });
  });

  it("rejects unavailable target versions", async () => {
    await withLock("0.1.0", async (root) => {
      const result = runCli(["upgrade", "auth", "--to", "9.9.9", "--plan", "--json"], root);
      const payload = parseStdout(result);
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("MODULE_VERSION_NOT_FOUND");
    });
  });

  it("generates governed tool manifests for Code Memory", () => {
    const result = runCli(["tools", "manifest", "--modules", "code-memory", "--json"], process.cwd());
    expect(result.status).toBe(0);
    const payload = parseStdout(result);
    expect(payload.ok).toBe(true);
    expect(payload.data.modules).toEqual([{ id: "code-memory", version: "0.1.0" }]);
    expect(payload.data.tools).toHaveLength(8);
    expect(payload.data.tools.find((tool) => tool.name === "code-memory_searchLogicCapsules")).toMatchObject({
      mutation: false,
      requiresConfirmation: false,
      scope: "code-memory.read",
    });
    expect(payload.data.tools.find((tool) => tool.name === "code-memory_approveLogicCapsule")).toMatchObject({
      mutation: true,
      requiresConfirmation: true,
      scope: "code-memory.approve",
    });
  });
});
