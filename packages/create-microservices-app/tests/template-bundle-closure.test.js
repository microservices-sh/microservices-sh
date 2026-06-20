import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_MODULES, BUNDLED_PACKAGES, PUBLISHED_ALLOWLIST } from "../src/bundled-deps.js";

// Guards the class of break behind the "research" CI red (commit 0faf068): a
// template gained an @microservices-sh dependency the scaffolder doesn't bundle,
// so the rewrite left it as `workspace:*` and `pnpm install` failed in the
// standalone generated app. CI only scaffolds ONE template (booking), so a drift
// in any other template ships broken. This checks ALL templates statically — and
// is a vitest test (not node:test) so it rides the root `pnpm test` suite CI runs.

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

// Source package.json a bundled @microservices-sh dep is vendored from, so we can
// walk its transitive @microservices-sh deps. null for leaves (published, or not
// bundled — the latter is flagged by the `allowed` check, no need to recurse).
function srcPkgFor(name) {
  const id = name.slice(MS.length);
  if (BUNDLED_MODULES.includes(id)) return resolve(repoRoot, "modules", id, "package.json");
  if (BUNDLED_PACKAGES.has(name)) return resolve(repoRoot, "packages", BUNDLED_PACKAGES.get(name), "package.json");
  return null;
}

function unbundledClosure(templateId) {
  const closure = new Set(msDeps(resolve(templatesDir, templateId, "package.json")));
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
  return [...closure].filter((name) => !allowed.has(name)).sort();
}

const templates = readdirSync(templatesDir).filter((dir) =>
  existsSync(resolve(templatesDir, dir, "package.json"))
);

describe("template bundle closure (generated apps install standalone)", () => {
  it.each(templates)("%s bundles every @microservices-sh dependency", (tpl) => {
    const unbundled = unbundledClosure(tpl);
    expect(
      unbundled,
      `${tpl} depends (transitively) on @microservices-sh packages the scaffolder won't vendor: ` +
        `${unbundled.join(", ")}. Add them to BUNDLED_MODULES/BUNDLED_PACKAGES (src/bundled-deps.js) ` +
        `AND the per-template copy lists in scripts/build.js, or the generated app's install will fail.`
    ).toEqual([]);
  });

  it("single-sources the bundle lists (sanity)", () => {
    expect(BUNDLED_MODULES).toContain("research");
    expect(BUNDLED_PACKAGES.has("@microservices-sh/ops-token")).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(5);
  });
});
