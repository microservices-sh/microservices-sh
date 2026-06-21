import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_MODULES,
  BUNDLED_PACKAGES,
  PUBLISHED_ALLOWLIST,
  REPO_TEMPLATES,
  REPO_TEMPLATE_MODULES,
  REPO_TEMPLATE_PACKAGES,
} from "../src/bundled-deps.js";

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

// Full transitive @microservices-sh dependency closure of a template.
function depClosure(templateId) {
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
  return [...closure];
}

const templates = readdirSync(templatesDir).filter((dir) =>
  existsSync(resolve(templatesDir, dir, "package.json"))
);

describe("template bundle closure (generated apps install standalone)", () => {
  // Half 1 — "rewritten": every dep in the closure is bundleable, so the
  // scaffolder rewrites it to a local path instead of leaving it `workspace:*`.
  it.each(templates)("%s bundles every @microservices-sh dependency", (tpl) => {
    const unbundled = depClosure(tpl).filter((name) => !allowed.has(name)).sort();
    expect(
      unbundled,
      `${tpl} depends (transitively) on @microservices-sh packages the scaffolder won't vendor: ` +
        `${unbundled.join(", ")}. Add them to BUNDLED_MODULES/BUNDLED_PACKAGES (src/bundled-deps.js) ` +
        `AND the per-template copy lists (REPO_TEMPLATE_MODULES/PACKAGES), or the install will fail.`
    ).toEqual([]);
  });

  // A template that ships a `vitest` test script must declare the dependency, or
  // a scaffolded app's first `pnpm test` fails with "vitest: not found".
  it.each(templates)("%s ships vitest if it has a vitest test script", (tpl) => {
    const pkg = JSON.parse(readFileSync(resolve(templatesDir, tpl, "package.json"), "utf8"));
    if (!pkg.scripts?.test?.includes("vitest")) return;
    expect(
      pkg.devDependencies?.vitest,
      `${tpl}: has a "vitest" test script but no vitest devDependency`
    ).toBeTruthy();
  });

  // Half 2 — "copied": every module/package in a scaffoldable template's closure
  // is in its copy list, so the local dep the scaffolder writes points at source
  // that actually got bundled (not a missing dir).
  it.each(REPO_TEMPLATES)("%s copies the source for every dep it rewrites", (tpl) => {
    const closure = depClosure(tpl);
    const neededModules = closure
      .map((name) => name.slice(MS.length))
      .filter((id) => BUNDLED_MODULES.includes(id));
    const neededPackages = closure.filter((name) => BUNDLED_PACKAGES.has(name));

    const copiedModules = new Set(REPO_TEMPLATE_MODULES[tpl] ?? []);
    const copiedPackages = new Set((REPO_TEMPLATE_PACKAGES[tpl] ?? []).map((dir) => dir));

    const missingModules = neededModules.filter((id) => !copiedModules.has(id)).sort();
    const missingPackages = neededPackages
      .filter((name) => !copiedPackages.has(BUNDLED_PACKAGES.get(name)))
      .sort();

    expect(
      { missingModules, missingPackages },
      `${tpl}: these deps are rewritten to local paths but their source isn't copied ` +
        `(add to REPO_TEMPLATE_MODULES/PACKAGES in src/bundled-deps.js): ` +
        `modules=${missingModules.join(",") || "none"} packages=${missingPackages.join(",") || "none"}`
    ).toEqual({ missingModules: [], missingPackages: [] });
  });

  it("single-sources the manifest (sanity)", () => {
    expect(BUNDLED_MODULES).toContain("research");
    expect(BUNDLED_PACKAGES.has("@microservices-sh/ops-token")).toBe(true);
    expect(REPO_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(templates.length).toBeGreaterThanOrEqual(5);
  });
});
