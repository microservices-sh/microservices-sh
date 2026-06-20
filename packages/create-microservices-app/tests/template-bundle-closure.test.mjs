import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_MODULES, BUNDLED_PACKAGES, PUBLISHED_ALLOWLIST } from "../src/bundled-deps.js";

// Guards the class of break behind the "research" CI red (commit 0faf068): a
// template gained an @microservices-sh dependency the scaffolder doesn't bundle,
// so the rewrite left it as `workspace:*` and `pnpm install` failed in the
// standalone generated app. CI only scaffolds ONE template (booking), so a drift
// in any other template ships broken. This test checks ALL templates statically.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const templatesDir = resolve(repoRoot, "templates");
const MS = "@microservices-sh/";

const allowed = new Set([
  ...BUNDLED_MODULES.map((id) => MS + id),
  ...BUNDLED_PACKAGES.keys(),
  ...PUBLISHED_ALLOWLIST,
]);

function msDeps(pkgPath) {
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return Object.keys(pkg.dependencies || {}).filter((name) => name.startsWith(MS));
}

// The source package.json a bundled @microservices-sh dep is vendored from, so we
// can walk its transitive @microservices-sh deps. null for leaves (published or
// not-bundled — the latter is flagged by the `allowed` check, no need to recurse).
function srcPkgFor(name) {
  const id = name.slice(MS.length);
  if (BUNDLED_MODULES.includes(id)) return resolve(repoRoot, "modules", id, "package.json");
  if (BUNDLED_PACKAGES.has(name)) return resolve(repoRoot, "packages", BUNDLED_PACKAGES.get(name), "package.json");
  return null;
}

const templates = readdirSync(templatesDir).filter((dir) =>
  existsSync(resolve(templatesDir, dir, "package.json"))
);

for (const tpl of templates) {
  test(`generated ${tpl} bundles every @microservices-sh dependency (no workspace dep the scaffolder skips)`, () => {
    // Transitive closure of the template's @microservices-sh deps.
    const closure = new Set(msDeps(resolve(templatesDir, tpl, "package.json")));
    const queue = [...closure];
    const seen = new Set();
    while (queue.length) {
      const name = queue.shift();
      if (seen.has(name)) continue;
      seen.add(name);
      const src = srcPkgFor(name);
      if (src) {
        for (const dep of msDeps(src)) {
          closure.add(dep);
          if (!seen.has(dep)) queue.push(dep);
        }
      }
    }

    const unbundled = [...closure].filter((name) => !allowed.has(name)).sort();
    assert.deepEqual(
      unbundled,
      [],
      `${tpl} depends (transitively) on @microservices-sh packages the scaffolder won't vendor: ` +
        `${unbundled.join(", ")}. Add them to BUNDLED_MODULES/BUNDLED_PACKAGES (src/bundled-deps.js) ` +
        `AND the per-template copy lists in scripts/build.js, or the generated app's install will fail.`
    );
  });
}

test("the lists single-source correctly (sanity)", () => {
  assert.ok(BUNDLED_MODULES.includes("research"), "research must be bundled (it's a booking dep)");
  assert.ok(BUNDLED_PACKAGES.has("@microservices-sh/ops-token"), "ops-token must be bundled (research dep)");
  assert.ok(templates.length >= 5, "expected the template set to be discovered");
});
