import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const shimPath = resolve(testDir, "../shim/microservices.js");

async function createApp() {
  const root = await mkdtemp(join(tmpdir(), "msh-shim-remove-"));
  const app = join(root, "app");
  await mkdir(app, { recursive: true });
  return { root, app };
}

function runShim(app, args) {
  return spawnSync(process.execPath, [shimPath, ...args], {
    cwd: app,
    env: { ...process.env, MICROSERVICES_TELEMETRY: "0" },
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

// Vendor a module: a modules/<id>/ dir with module.json + lock entry.
async function vendorModule(app, id, { requires = [], version = "0.1.0" } = {}) {
  const dir = join(app, "modules", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "module.json"),
    JSON.stringify({ id, version, connections: { requires } }, null, 2) + "\n"
  );
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: `@microservices-sh/${id}`, version }, null, 2) + "\n"
  );
}

async function writeLock(app, modules) {
  await writeFile(
    join(app, "microservices.lock.json"),
    JSON.stringify({ template: "booking-business", modules }, null, 2) + "\n"
  );
}

async function readLock(app) {
  return JSON.parse(await readFile(join(app, "microservices.lock.json"), "utf8"));
}

test("remove deletes the vendored module dir and the lock entry", async () => {
  const { root, app } = await createApp();
  try {
    await vendorModule(app, "payment");
    await writeLock(app, [{ id: "payment", version: "0.1.0", path: "modules/payment" }]);

    const result = runShim(app, ["remove", "payment", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.removed, "payment");

    assert.equal(existsSync(join(app, "modules", "payment")), false);
    const lock = await readLock(app);
    assert.equal(lock.modules.some((m) => m.id === "payment"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("remove --plan previews without touching the project", async () => {
  const { root, app } = await createApp();
  try {
    await vendorModule(app, "payment");
    await writeLock(app, [{ id: "payment", version: "0.1.0", path: "modules/payment" }]);

    const result = runShim(app, ["remove", "payment", "--plan", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.plan, true);

    assert.equal(existsSync(join(app, "modules", "payment")), true);
    const lock = await readLock(app);
    assert.equal(lock.modules.some((m) => m.id === "payment"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("remove fails when the module is not installed", async () => {
  const { root, app } = await createApp();
  try {
    await writeLock(app, [{ id: "payment", version: "0.1.0", path: "modules/payment" }]);
    const result = runShim(app, ["remove", "booking", "--json"]);
    assert.equal(result.status, 1);
    const payload = parseJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "MODULE_NOT_INSTALLED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("remove accepts the CLI-portable --apply form", async () => {
  const { root, app } = await createApp();
  try {
    await vendorModule(app, "payment");
    await writeLock(app, [{ id: "payment", version: "0.1.0", path: "modules/payment" }]);

    const result = runShim(app, ["remove", "payment", "--apply", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parseJson(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.removed, "payment");
    assert.equal(existsSync(join(app, "modules", "payment")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("remove is blocked when another installed module still requires it", async () => {
  const { root, app } = await createApp();
  try {
    await vendorModule(app, "invoice", { requires: ["customer"] });
    await vendorModule(app, "accounts-receivable", { requires: ["customer", "invoice"] });
    await writeLock(app, [
      { id: "invoice", version: "0.1.0", path: "modules/invoice" },
      { id: "accounts-receivable", version: "0.1.0", path: "modules/accounts-receivable" },
    ]);

    const result = runShim(app, ["remove", "invoice", "--json"]);
    assert.equal(result.status, 1);
    const payload = parseJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "MODULE_REQUIRED");

    // nothing removed on a blocked attempt
    assert.equal(existsSync(join(app, "modules", "invoice")), true);
    const lock = await readLock(app);
    assert.equal(lock.modules.some((m) => m.id === "invoice"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
