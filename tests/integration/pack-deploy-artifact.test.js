import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packScript = join(repoRoot, "scripts/pack-deploy-artifact.mjs");

async function writeFixtureFile(root, path, contents = "") {
  const abs = join(root, path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents);
}

async function createBuiltTemplate(extraFiles = []) {
  const root = await mkdtemp(join(tmpdir(), "microservices-pack-artifact-"));
  await writeFixtureFile(root, ".svelte-kit/cloudflare/_worker.js", "export default {};\n");
  await writeFixtureFile(root, ".svelte-kit/cloudflare/_app/version.json", "{}\n");
  await writeFixtureFile(root, ".svelte-kit/output/server/index.js", "export const manifest = {};\n");
  await writeFixtureFile(root, ".svelte-kit/cloudflare-tmp/manifest.js", "export default {};\n");
  await writeFixtureFile(root, "migrations/0001_init.sql", "create table demo (id text primary key);\n");
  await writeFixtureFile(root, "wrangler.jsonc", "{}\n");
  await writeFixtureFile(root, "microservices.config.json", JSON.stringify({ appName: "Demo" }));
  await writeFixtureFile(
    root,
    "microservices.template.json",
    JSON.stringify({ id: "fixture-template", version: "0.1.0", name: "Fixture Template" })
  );
  await writeFixtureFile(
    root,
    "microservices.lock.json",
    JSON.stringify({ modules: [{ id: "auth" }, { id: "billing-subscriptions" }] })
  );
  await writeFixtureFile(root, "package.json", JSON.stringify({ name: "fixture-template" }));

  for (const file of extraFiles) {
    await writeFixtureFile(root, file.path, file.contents);
  }
  return root;
}

async function withBuiltTemplate(extraFiles, fn) {
  const root = await createBuiltTemplate(extraFiles);
  const outDir = join(root, ".out");
  try {
    return await fn(root, outDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function pack(root, outDir) {
  return spawnSync(process.execPath, [packScript, root, "--template", "fixture-template", "--out", outDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("pack deploy artifact", () => {
  it("writes a preview request payload with a top-level artifact", async () => {
    await withBuiltTemplate([], async (root, outDir) => {
      const result = pack(root, outDir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("POST /deployments/preview shape");

      const payload = JSON.parse(await readFile(join(outDir, "payload.json"), "utf8"));
      expect(payload).toMatchObject({
        templateId: "fixture-template",
        modules: ["auth", "billing-subscriptions"],
        prebuilt: true,
        artifactVersion: "0.1.0",
        artifact: {
          source: "ci-prebuilt",
          composition: {
            template: { id: "fixture-template" },
            modules: [{ id: "auth" }, { id: "billing-subscriptions" }],
          },
        },
      });
      expect(Array.isArray(payload.artifact.files)).toBe(true);
      expect(payload.artifact.files.some((file) => file.path === ".svelte-kit/cloudflare/_worker.js")).toBe(true);
    });
  });

  it("rejects non-UTF-8 files before writing an inline payload", async () => {
    await withBuiltTemplate([{ path: ".svelte-kit/cloudflare/_app/font.woff", contents: Buffer.from([0xff, 0x00]) }], async (root, outDir) => {
      const result = pack(root, outDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("binary file");
      expect(result.stderr).toContain("font.woff");
    });
  });

  it("enforces the inline artifact file count limit", async () => {
    const extraFiles = Array.from({ length: 991 }, (_, index) => ({
      path: `.svelte-kit/cloudflare/_app/chunks/${index}.js`,
      contents: `export const n = ${index};\n`,
    }));
    await withBuiltTemplate(extraFiles, async (root, outDir) => {
      const result = pack(root, outDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("too many files: 1001 > 1000");
    });
  });
});
