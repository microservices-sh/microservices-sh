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

// Fake git that materialises a multi-module repo from FAKE_MODULES
// ({ "<id>": ["<requiredId>", ...] }). Each clone/fetch writes the whole
// modules/ tree so resolveModuleSource can extract any requested module,
// and every module ships a module.json declaring its connections.requires.
const fakeGitScript = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const spec = JSON.parse(process.env.FAKE_MODULES || "{}");

function writeModules(repoDir) {
  for (const [id, requires] of Object.entries(spec)) {
    const dir = path.join(repoDir, "modules", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "@microservices-sh/" + id, version: "0.1.0" }, null, 2) + "\\n"
    );
    fs.writeFileSync(
      path.join(dir, "module.json"),
      JSON.stringify({ id, version: "0.1.0", connections: { requires } }, null, 2) + "\\n"
    );
  }
}

if (args[0] === "init") { fs.mkdirSync(args[args.length - 1], { recursive: true }); process.exit(0); }
if (args[0] === "clone") { writeModules(args[args.length - 1]); process.exit(0); }
if (args[0] === "-C") {
  const repoDir = args[1];
  const command = args[2];
  if (command === "remote") process.exit(0);
  if (command === "fetch") { writeModules(repoDir); process.exit(0); }
  if (command === "checkout") process.exit(0);
  if (command === "rev-parse") { process.stdout.write("deadbeefcafebabe\\n"); process.exit(0); }
}
process.stderr.write("unexpected fake git args: " + JSON.stringify(args) + "\\n");
process.exit(1);
`;

async function createHarness(modules) {
  const root = await mkdtemp(join(tmpdir(), "msh-shim-install-"));
  const app = join(root, "app");
  const bin = join(root, "bin");
  await mkdir(app, { recursive: true });
  await mkdir(bin, { recursive: true });
  const gitPath = join(bin, "git");
  await writeFile(gitPath, fakeGitScript, "utf8");
  await chmod(gitPath, 0o755);
  return {
    root,
    app,
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      MICROSERVICES_TELEMETRY: "0",
      MICROSERVICES_MODULE_SOURCE_URL: "https://example.test/repo.git",
      FAKE_MODULES: JSON.stringify(modules),
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
    throw new Error(`Invalid JSON stdout: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

async function writeConfig(harness, config) {
  await writeFile(join(harness.app, "microservices.config.json"), JSON.stringify(config, null, 2) + "\n");
}

async function readLock(harness) {
  return JSON.parse(await readFile(join(harness.app, "microservices.lock.json"), "utf8"));
}

async function readConfig(harness) {
  return JSON.parse(await readFile(join(harness.app, "microservices.config.json"), "utf8"));
}

test("install vendors the listed module and its transitive requires", async () => {
  const harness = await createHarness({ payment: ["customer"], customer: [], gateway: [] });
  try {
    await writeConfig(harness, { template: "booking-business", modules: ["payment"] });
    const result = runShim(harness, ["install", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);

    // payment listed, customer pulled in as a transitive dependency
    assert.equal(existsSync(join(harness.app, "modules", "payment")), true);
    assert.equal(existsSync(join(harness.app, "modules", "customer")), true);
    const lock = await readLock(harness);
    const ids = lock.modules.map((m) => m.id).sort();
    assert.deepEqual(ids, ["customer", "payment"]);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("install is idempotent: a second run reports everything present", async () => {
  const harness = await createHarness({ payment: ["customer"], customer: [] });
  try {
    await writeConfig(harness, { template: "booking-business", modules: ["payment"] });
    assert.equal(runShim(harness, ["install", "--json"]).status, 0);

    const result = runShim(harness, ["install", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    const statuses = payload.data.installed.reduce((acc, entry) => {
      acc[entry.id] = entry.status;
      return acc;
    }, {});
    assert.equal(statuses.payment, "present");
    assert.equal(statuses.customer, "present");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("add records the module in microservices.config.json (intent)", async () => {
  const harness = await createHarness({ payment: ["customer"], customer: [] });
  try {
    const result = runShim(harness, ["add", "payment", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const config = await readConfig(harness);
    assert.ok(config.modules.includes("payment@0.1.0"));
    // add vendors only the named module; transitive deps are NOT recorded as intent
    assert.equal(config.modules.includes("customer@0.1.0"), false);
    assert.equal(config.modules.some((m) => m.startsWith("customer")), false);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("install does not add transitive deps to the intent file", async () => {
  const harness = await createHarness({ payment: ["customer"], customer: [] });
  try {
    await writeConfig(harness, { template: "booking-business", modules: ["payment"] });
    assert.equal(runShim(harness, ["install", "--json"]).status, 0);
    const config = await readConfig(harness);
    // customer was vendored as a dep, but intent stays exactly what the user listed
    assert.deepEqual(config.modules, ["payment"]);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("remove drops the module from microservices.config.json", async () => {
  const harness = await createHarness({ payment: ["customer"], customer: [] });
  try {
    runShim(harness, ["add", "customer", "--json"]);
    runShim(harness, ["add", "payment", "--json"]);
    const result = runShim(harness, ["remove", "payment", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const config = await readConfig(harness);
    assert.equal(config.modules.some((m) => m.startsWith("payment")), false);
    assert.ok(config.modules.some((m) => m.startsWith("customer")));
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("install reports a failure for an unknown module but still vendors the rest", async () => {
  const harness = await createHarness({ customer: [] });
  try {
    await writeConfig(harness, { template: "booking-business", modules: ["customer", "does-not-exist"] });
    const result = runShim(harness, ["install", "--json"]);
    assert.equal(result.status, 1);
    const payload = parseJson(result);
    assert.equal(payload.ok, false);
    assert.equal(existsSync(join(harness.app, "modules", "customer")), true);
    assert.ok(payload.data.failed.some((f) => f.id === "does-not-exist"));
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});
