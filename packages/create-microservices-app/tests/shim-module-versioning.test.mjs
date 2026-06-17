import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const shimPath = resolve(testDir, "../shim/microservices.js");

const fakeGitScript = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GIT_LOG, JSON.stringify(args) + "\\n");

function writeModule(repoDir) {
  const moduleDir = path.join(repoDir, "modules", "payment");
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.writeFileSync(
    path.join(moduleDir, "package.json"),
    JSON.stringify({
      name: "@microservices-sh/payment",
      version: process.env.FAKE_MODULE_VERSION || "0.1.0",
      dependencies: {
        "@microservices-sh/connection-contract": "workspace:*",
        "@microservices-sh/customer": "workspace:*"
      }
    }, null, 2) + "\\n"
  );
}

if (args[0] === "init") {
  fs.mkdirSync(args[args.length - 1], { recursive: true });
  process.exit(0);
}

if (args[0] === "clone") {
  writeModule(args[args.length - 1]);
  process.exit(0);
}

if (args[0] === "-C") {
  const repoDir = args[1];
  const command = args[2];
  if (command === "remote") process.exit(0);
  if (command === "fetch") {
    if (process.env.FAKE_GIT_FETCH_FAIL === "1") process.exit(1);
    writeModule(repoDir);
    fs.writeFileSync(path.join(repoDir, "FETCHED_REF"), args[args.length - 1] + "\\n");
    process.exit(0);
  }
  if (command === "checkout") process.exit(0);
  if (command === "rev-parse") {
    process.stdout.write("deadbeefcafebabe\\n");
    process.exit(0);
  }
}

process.stderr.write("unexpected fake git args: " + JSON.stringify(args) + "\\n");
process.exit(1);
`;

async function createHarness(options = {}) {
  const root = await mkdtemp(join(tmpdir(), "msh-shim-version-"));
  const app = join(root, "app");
  const bin = join(root, "bin");
  const logPath = join(root, "git.log");
  await mkdir(app, { recursive: true });
  await mkdir(bin, { recursive: true });
  const gitPath = join(bin, "git");
  await writeFile(gitPath, fakeGitScript, "utf8");
  await chmod(gitPath, 0o755);
  return {
    root,
    app,
    logPath,
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      MICROSERVICES_TELEMETRY: "0",
      MICROSERVICES_MODULE_SOURCE_URL: "https://example.test/repo.git",
      FAKE_GIT_LOG: logPath,
      FAKE_MODULE_VERSION: options.moduleVersion || "0.1.0",
      ...(options.fetchFail ? { FAKE_GIT_FETCH_FAIL: "1" } : {}),
    },
  };
}

function runShim(harness, args) {
  return spawnSync(process.execPath, [shimPath, ...args], {
    cwd: harness.app,
    env: harness.env,
    encoding: "utf8",
  });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON stdout: ${error.message}\\nstdout:\\n${result.stdout}\\nstderr:\\n${result.stderr}`);
  }
}

async function readGitLog(harness) {
  return (await readFile(harness.logPath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeInstalledPayment(harness, version, extraFiles = {}) {
  const moduleDir = join(harness.app, "modules", "payment");
  await mkdir(moduleDir, { recursive: true });
  await writeFile(
    join(moduleDir, "package.json"),
    JSON.stringify({ name: "@microservices-sh/payment", version }, null, 2) + "\n"
  );
  for (const [name, content] of Object.entries(extraFiles)) {
    await writeFile(join(moduleDir, name), content, "utf8");
  }
}

async function writeLock(harness, moduleEntry) {
  await writeFile(
    join(harness.app, "microservices.lock.json"),
    JSON.stringify({ template: "test-template", modules: [moduleEntry] }, null, 2) + "\n"
  );
}

async function readLock(harness) {
  return JSON.parse(await readFile(join(harness.app, "microservices.lock.json"), "utf8"));
}

test("versioned add plan fetches the module release tag", async () => {
  const harness = await createHarness();
  try {
    const result = runShim(harness, ["add", "payment@0.1.0", "--plan", "--json"]);
    assert.equal(result.status, 0);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.requestedVersion, "0.1.0");
    assert.equal(payload.data.sourceResolution, "release-tag");
    assert.equal(payload.data.sourceRef.ref, "refs/tags/modules/payment/v0.1.0");
    assert.equal(existsSync(join(harness.app, "modules", "payment")), false);

    const log = await readGitLog(harness);
    assert.ok(log.some((args) => args.includes("fetch") && args.includes("refs/tags/modules/payment/v0.1.0")));
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("versioned add writes source refs into the lockfile", async () => {
  const harness = await createHarness();
  try {
    const result = runShim(harness, ["add", "payment@0.1.0", "--json"]);
    assert.equal(result.status, 0);
    const lock = JSON.parse(await readFile(join(harness.app, "microservices.lock.json"), "utf8"));
    assert.equal(lock.modules[0].id, "payment");
    assert.equal(lock.modules[0].source, "registry:payment@0.1.0");
    assert.equal(lock.modules[0].sourceRef.ref, "refs/tags/modules/payment/v0.1.0");
    assert.equal(lock.modules[0].ref, "deadbeefcafebabe");
    assert.equal(lock.modules[0].sourceResolution, "release-tag");
    const modulePackage = JSON.parse(await readFile(join(harness.app, "modules", "payment", "package.json"), "utf8"));
    assert.equal(modulePackage.dependencies["@microservices-sh/connection-contract"], "file:../../packages/connection-contract");
    assert.equal(modulePackage.dependencies["@microservices-sh/customer"], "file:../customer");

    const reinstall = runShim(harness, ["upgrade", "payment", "--to", "0.1.0", "--json"]);
    assert.equal(reinstall.status, 0, reinstall.stderr || reinstall.stdout);
    const reinstallPayload = parseJson(reinstall);
    assert.equal(reinstallPayload.ok, true);
    assert.equal(reinstallPayload.data.action, "reinstall");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("versioned add fails when the release tag is unavailable", async () => {
  const harness = await createHarness({ fetchFail: true });
  try {
    const result = runShim(harness, ["add", "payment@0.1.0", "--plan", "--json"]);
    assert.equal(result.status, 1);
    const payload = parseJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "MODULE_SOURCE_REF_NOT_FOUND");
    assert.equal(payload.error.details.sourceRef.ref, "refs/tags/modules/payment/v0.1.0");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("unversioned add plan keeps using the current source snapshot", async () => {
  const harness = await createHarness();
  try {
    const result = runShim(harness, ["add", "payment", "--plan", "--json"]);
    assert.equal(result.status, 0);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.sourceResolution, "current-snapshot");

    const log = await readGitLog(harness);
    assert.ok(log.some((args) => args[0] === "clone"));
    assert.equal(log.some((args) => args.includes("fetch")), false);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("upgrade plan includes the target source ref", async () => {
  const harness = await createHarness({ moduleVersion: "0.2.0" });
  try {
    await writeInstalledPayment(harness, "0.1.0");
    await writeLock(harness, { id: "payment", version: "0.1.0", contract: {} });

    const result = runShim(harness, ["upgrade", "payment", "--to", "0.2.0", "--plan", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.module.currentVersion, "0.1.0");
    assert.equal(payload.data.module.targetVersion, "0.2.0");
    assert.equal(payload.data.lockfile.targetSourceRef.ref, "refs/tags/modules/payment/v0.2.0");
    const modulePackage = JSON.parse(await readFile(join(harness.app, "modules", "payment", "package.json"), "utf8"));
    assert.equal(modulePackage.version, "0.1.0");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("upgrade applies the target module source and replaces stale files", async () => {
  const harness = await createHarness({ moduleVersion: "0.2.0" });
  try {
    await writeInstalledPayment(harness, "0.1.0", { "removed.ts": "stale\n" });
    await writeLock(harness, {
      id: "payment",
      version: "0.1.0",
      mode: "copied",
      customizationMode: "editable",
      contract: { stable: true },
    });

    const result = runShim(harness, ["upgrade", "payment", "--to", "0.2.0", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.direction, "upgrade");
    assert.equal(payload.data.targetVersion, "0.2.0");
    assert.equal(payload.data.sourceRef.ref, "refs/tags/modules/payment/v0.2.0");

    const modulePackage = JSON.parse(await readFile(join(harness.app, "modules", "payment", "package.json"), "utf8"));
    assert.equal(modulePackage.version, "0.2.0");
    assert.equal(modulePackage.dependencies["@microservices-sh/connection-contract"], "file:../../packages/connection-contract");
    assert.equal(modulePackage.dependencies["@microservices-sh/customer"], "file:../customer");
    assert.equal(existsSync(join(harness.app, "modules", "payment", "removed.ts")), false);

    const lock = await readLock(harness);
    assert.equal(lock.modules[0].version, "0.2.0");
    assert.equal(lock.modules[0].source, "registry:payment@0.2.0");
    assert.equal(lock.modules[0].sourceRef.ref, "refs/tags/modules/payment/v0.2.0");
    assert.equal(lock.modules[0].ref, "deadbeefcafebabe");
    assert.equal(lock.modules[0].sourceResolution, "release-tag");
    assert.equal(lock.modules[0].mode, "copied");
    assert.equal(lock.modules[0].customizationMode, "editable");
    assert.equal(lock.modules[0].contract.stable, true);
    assert.equal(Boolean(lock.modules[0].integrity), true);
    assert.equal("checksum" in lock.modules[0], false);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("upgrade can apply a downgrade target", async () => {
  const harness = await createHarness({ moduleVersion: "0.1.0" });
  try {
    await writeInstalledPayment(harness, "0.2.0");
    await writeLock(harness, { id: "payment", version: "0.2.0", contract: {} });

    const result = runShim(harness, ["upgrade", "payment", "--to", "0.1.0", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.direction, "downgrade");
    assert.equal(payload.data.targetVersion, "0.1.0");

    const lock = await readLock(harness);
    assert.equal(lock.modules[0].version, "0.1.0");
    assert.equal(lock.modules[0].sourceRef.ref, "refs/tags/modules/payment/v0.1.0");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("upgrade refuses to replace locally changed modules without confirmation", async () => {
  const harness = await createHarness({ moduleVersion: "0.2.0" });
  try {
    await writeInstalledPayment(harness, "0.1.0", { "custom.ts": "local edit\n" });
    await writeLock(harness, {
      id: "payment",
      version: "0.1.0",
      integrity: "sha256-old-lock-value",
      contract: {},
    });

    const result = runShim(harness, ["upgrade", "payment", "--to", "0.2.0", "--json"]);
    assert.equal(result.status, 1);
    const payload = parseJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "MODULE_LOCAL_CHANGES");
    assert.equal(payload.error.details.confirmationRequired, "overwrite");

    const modulePackage = JSON.parse(await readFile(join(harness.app, "modules", "payment", "package.json"), "utf8"));
    assert.equal(modulePackage.version, "0.1.0");
    assert.equal(existsSync(join(harness.app, "modules", "payment", "custom.ts")), true);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});
