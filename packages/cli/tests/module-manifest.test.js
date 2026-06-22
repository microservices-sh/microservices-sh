import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, INIT_CWD: cwd, MICROSERVICES_TELEMETRY: "0" },
  });
}

function parse(result) {
  return JSON.parse(result.stdout);
}

function expectOk(result) {
  expect(result.status).toBe(0);
  const payload = parse(result);
  expect(payload.ok).toBe(true);
  return payload;
}

function expectFailure(result, code) {
  expect(result.status).not.toBe(0);
  const payload = parse(result);
  expect(payload.ok).toBe(false);
  expect(payload.error.code).toBe(code);
  return payload;
}

async function readConfig(root) {
  return JSON.parse(await readFile(join(root, "microservices.config.json"), "utf8"));
}

async function readLock(root) {
  return JSON.parse(await readFile(join(root, "microservices.lock.json"), "utf8"));
}

describe("CLI manifest mutation (add/remove --apply)", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "microservices-cli-manifest-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("add --apply writes config + lock with the pinned module", async () => {
    const result = runCli(["add", "payment", "--apply", "--json"], root);
    const payload = expectOk(result);
    expect(payload.data.added).toBe("payment@0.1.0");

    const config = await readConfig(root);
    expect(config.template).toBe("booking-business");
    expect(config.modules).toContain("payment@0.1.0");

    const lock = await readLock(root);
    expect(lock.modules.some((m) => m.id === "payment")).toBe(true);
  });

  it("add --apply is idempotent-safe: rejects a module already in the set", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const again = runCli(["add", "payment", "--apply", "--json"], root);
    expectFailure(again, "MODULE_PRESENT");
  });

  it("add --apply rejects a template default module", async () => {
    const result = runCli(["add", "customer", "--apply", "--json"], root);
    expectFailure(result, "MODULE_PRESENT");
  });

  it("add --apply preserves existing user config fields", async () => {
    await writeFile(
      join(root, "microservices.config.json"),
      JSON.stringify({ template: "booking-business", modules: [], business: { name: "Acme" } }, null, 2),
      "utf8"
    );
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const config = await readConfig(root);
    expect(config.business).toEqual({ name: "Acme" });
    expect(config.modules).toContain("payment@0.1.0");
  });

  it("remove --apply removes an intent module and rewrites config + lock", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["remove", "payment", "--apply", "--json"], root);
    const payload = expectOk(result);
    expect(payload.data.removed).toBe("payment");

    const config = await readConfig(root);
    expect(config.modules).not.toContain("payment@0.1.0");

    const lock = await readLock(root);
    expect(lock.modules.some((m) => m.id === "payment")).toBe(false);
  });

  it("remove --apply blocks removal when another module still requires it", async () => {
    expectOk(runCli(["add", "invoice", "--apply", "--json"], root));
    expectOk(runCli(["add", "accounts-receivable", "--apply", "--json"], root));
    const result = runCli(["remove", "invoice", "--apply", "--json"], root);
    expectFailure(result, "MODULE_REQUIRED");

    // intent list must be unchanged after a blocked removal
    const config = await readConfig(root);
    expect(config.modules.some((m) => String(m).startsWith("invoice"))).toBe(true);
  });

  it("remove --apply rejects a module not in the manifest", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["remove", "booking", "--apply", "--json"], root);
    expectFailure(result, "MODULE_ABSENT");
  });

  it("remove requires --apply before mutating the manifest", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["remove", "payment", "--json"], root);
    expectFailure(result, "APPLY_REQUIRED");

    const config = await readConfig(root);
    expect(config.modules).toContain("payment@0.1.0");
  });

  it("check reads the manifest when no --modules flag is given", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["check", "--json"], root);
    const payload = expectOk(result);
    const dep = payload.data.checks.find((c) => c.id === "dependency-resolution");
    expect(dep.message).toContain("payment");
  });

  it("validate reads the manifest (reflects an added module's bindings)", async () => {
    expectOk(runCli(["add", "image-generation", "--apply", "--json"], root));
    const result = runCli(["validate", "--json"], root);
    const payload = expectOk(result);
    expect(payload.data.valid).toBe(true);
    expect(payload.data.requiredBindings).toContain("IMAGE_BUCKET");
  });

  it("generate reads the manifest when no --modules flag is given", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["generate", "--out", "app", "--json"], root);
    const payload = expectOk(result);
    const ids = payload.data.composition.modules.map((m) => m.id);
    expect(ids).toContain("payment");
  });

  it("explicit --modules overrides manifest intent in generated config output", async () => {
    expectOk(runCli(["add", "payment", "--apply", "--json"], root));
    const result = runCli(["generate", "--out", "app", "--modules", "code-memory", "--json"], root);
    const payload = expectOk(result);
    const ids = payload.data.composition.modules.map((m) => m.id);
    expect(ids).toContain("code-memory");
    expect(ids).not.toContain("payment");
    expect(payload.data.composition.config.modules).toEqual(["code-memory"]);
  });
});
