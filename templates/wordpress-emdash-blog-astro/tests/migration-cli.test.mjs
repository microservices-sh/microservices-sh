import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const templateRoot = resolve(testDir, "..");
const microservicesScript = resolve(templateRoot, "scripts/microservices.js");
const probeScript = resolve(templateRoot, "scripts/wp-probe.mjs");

test("theme archive analysis rejects fake zips", async () => {
  const workspace = await tempWorkspace();
  try {
    await writeFile(resolve(workspace, "fake.zip"), "not a zip", "utf8");
    const result = runNode(microservicesScript, ["wp", "analyze-theme", "fake.zip"], workspace);
    assert.notEqual(result.status, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("theme archive analysis classifies classic, block, and hybrid themes", async (t) => {
  if (!hasCommand("zip")) t.skip("zip command is required for archive fixture tests");

  for (const fixture of [
    {
      name: "classic",
      files: {
        "theme/style.css": "/*\nTheme Name: Classic\n*/\n",
        "theme/index.php": "<?php\n",
        "theme/functions.php": "<?php\n",
      },
    },
    {
      name: "block",
      files: {
        "theme/style.css": "/*\nTheme Name: Block\n*/\n",
        "theme/theme.json": "{}\n",
        "theme/templates/index.html": "<!-- wp:group /-->\n",
        "theme/parts/header.html": "<!-- wp:group /-->\n",
      },
    },
    {
      name: "hybrid",
      files: {
        "theme/style.css": "/*\nTheme Name: Hybrid\n*/\n",
        "theme/theme.json": "{}\n",
        "theme/index.php": "<?php\n",
        "theme/functions.php": "<?php\n",
        "theme/templates/index.html": "<!-- wp:group /-->\n",
      },
    },
  ]) {
    const workspace = await tempWorkspace();
    try {
      for (const [file, contents] of Object.entries(fixture.files)) {
        await mkdir(dirname(resolve(workspace, file)), { recursive: true });
        await writeFile(resolve(workspace, file), contents, "utf8");
      }
      const zip = spawnSync("zip", ["-qr", `${fixture.name}.zip`, "theme"], { cwd: workspace, encoding: "utf8" });
      assert.equal(zip.status, 0, zip.stderr);

      const result = runNode(microservicesScript, ["wp", "analyze-theme", `${fixture.name}.zip`], workspace);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const analysis = await readJson(resolve(workspace, ".migration/theme-analysis.json"));
      assert.equal(analysis.themes.activeTheme.themeType, fixture.name);
      assert.equal(analysis.themes.activeTheme.primaryRoot, "theme");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
});

test("WordPress probe merges EmDash Exporter-only custom post types", async (t) => {
  const workspace = await tempWorkspace();
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method === "HEAD" && url.pathname === "/wp-sitemap.xml") {
      response.writeHead(200);
      response.end();
      return;
    }

    if (url.pathname === "/wp-json/") {
      sendJson(response, {
        name: "Fixture",
        description: "",
        url: "http://127.0.0.1",
        home: "http://127.0.0.1",
        namespaces: ["wp/v2", "emdash/v1"],
      });
      return;
    }

    if (url.pathname === "/wp-json/emdash/v1/probe") {
      sendJson(response, {
        version: "1.0.0",
        post_types: ["wine", { id: "event", label: "Events", count: 2 }],
      });
      return;
    }

    if (url.pathname.startsWith("/wp-json/wp/v2/")) {
      response.setHeader("x-wp-total", "0");
      response.setHeader("x-wp-totalpages", "0");
      sendJson(response, []);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}");
  });

  try {
    try {
      await listen(server);
    } catch (error) {
      if (error.code === "EPERM") {
        t.skip("sandbox does not permit binding a local HTTP test server");
        return;
      }
      throw error;
    }
    const address = server.address();
    const source = `http://127.0.0.1:${address.port}`;
    const result = await runNodeAsync(probeScript, ["--source", source, "--out", "probe.json"], workspace);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = await readJson(resolve(workspace, "probe.json"));
    assert.deepEqual(report.detection.unsupportedTypes.sort(), ["event", "wine"]);
    assert.equal(report.exporterPostTypes.length, 2);
  } finally {
    server.close();
    await rm(workspace, { recursive: true, force: true });
  }
});

test("theme diff generates conservative parity report from captured PNG pairs", async () => {
  const workspace = await tempWorkspace();
  try {
    await mkdir(resolve(workspace, ".migration"), { recursive: true });
    await mkdir(resolve(workspace, "migration-reports/screenshots/source"), { recursive: true });
    await mkdir(resolve(workspace, "migration-reports/screenshots/rebuilt"), { recursive: true });
    await writeFile(resolve(workspace, ".migration/capture-plan.json"), JSON.stringify({
      version: 1,
      sourceUrl: "https://example.com",
      rebuiltUrl: "http://localhost:4321",
      pages: ["/"],
      widths: [390],
    }, null, 2));
    await writePng(resolve(workspace, "migration-reports/screenshots/source/home-390.png"), 2, 2, [240, 20, 20, 255]);
    await writePng(resolve(workspace, "migration-reports/screenshots/rebuilt/home-390.png"), 2, 2, [240, 20, 20, 255]);

    const result = runNode(microservicesScript, ["wp", "diff-theme"], workspace);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = await readJson(resolve(workspace, "migration-reports/theme-parity.json"));
    assert.equal(report.score, 70);
    assert.equal(report.launchReady, false);
    assert.equal(report.screenshots.comparedPairs, 1);
    assert.equal(report.metrics.designTokens.status, "manual-required");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function tempWorkspace() {
  return await mkdtemp(resolve(tmpdir(), "wp-emdash-cli-test-"));
}

function runNode(script, args, cwd) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      WP_APP_PASSWORD: "",
      WP_USERNAME: "",
    },
  });
}

function runNodeAsync(script, args, cwd) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: {
        ...process.env,
        WP_APP_PASSWORD: "",
        WP_USERNAME: "",
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
    child.on("close", (status, signal) => {
      resolvePromise({ status, signal, stdout, stderr });
    });
  });
}

function hasCommand(command) {
  return spawnSync(command, ["-v"], { encoding: "utf8" }).status === 0;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sendJson(response, value) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function listen(server) {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
}

async function writePng(path, width, height, rgba) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = rgba[0];
      raw[pixelOffset + 1] = rgba[1];
      raw[pixelOffset + 2] = rgba[2];
      raw[pixelOffset + 3] = rgba[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  await writeFile(path, png);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
