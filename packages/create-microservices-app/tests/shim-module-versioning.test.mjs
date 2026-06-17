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
    JSON.stringify({ name: "@microservices-sh/payment", version: process.env.FAKE_MODULE_VERSION || "0.1.0" }, null, 2) + "\\n"
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
  const harness = await createHarness();
  try {
    await mkdir(join(harness.app, "modules", "payment"), { recursive: true });
    await writeFile(
      join(harness.app, "modules", "payment", "package.json"),
      JSON.stringify({ name: "@microservices-sh/payment", version: "0.1.0" }, null, 2) + "\n"
    );
    await writeFile(
      join(harness.app, "microservices.lock.json"),
      JSON.stringify({ modules: [{ id: "payment", version: "0.1.0", contract: {} }] }, null, 2) + "\n"
    );

    const result = runShim(harness, ["upgrade", "payment", "--to", "0.1.0", "--plan", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.lockfile.targetSourceRef.ref, "refs/tags/modules/payment/v0.1.0");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});
