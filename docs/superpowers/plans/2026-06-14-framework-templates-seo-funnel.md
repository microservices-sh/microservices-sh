# Framework Templates + SEO Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add C3-wrapped framework-starter templates to `create-microservices-app` plus programmatic SEO landing pages, both driven by one shared `frameworks.json` manifest, to capture "<framework> cloudflare" search traffic and funnel it into the module ecosystem.

**Architecture:** A `frameworks.json` manifest is the single source of truth. The CLI gains a 3rd template-resolution mode ("framework starter") that shells out to Cloudflare's C3 (`create cloudflare`) for the framework + adapter scaffold, then injects an additive hook (config + README + a `package.json` script/dep + one banner line). The Astro landing site generates one SEO page per manifest row. New CLI logic lives in a dedicated, unit-testable module (`src/framework-starter.js`) so `src/index.js` stays a thin orchestrator.

**Tech Stack:** Node ≥20 (ESM, `node:test`, `spawnSync`), esbuild (CLI bundling), Cloudflare C3, Astro 6 (landing pages), JSON-LD schema.

**Spec:** `docs/superpowers/specs/2026-06-14-framework-templates-seo-funnel-design.md`

---

## Design Deviation From Spec (noted)

The spec sketched `src/hooks/<framework>/` directories. Since v1 is **README-only** and the hook content (config, README, `package.json` patch) is framework-agnostic — only the banner's target file (`hookEntry`) varies, and that path already lives in the manifest — per-framework hook directories are unnecessary duplication. Instead, one `applyFrameworkHook(appDir, row, pm)` generates everything from the manifest row. This is the DRY/YAGNI realization of the same design.

## File Structure

**Repo: `microservices-sh/` — package `packages/create-microservices-app/`**
- Create: `frameworks.json` — manifest (single source of truth), shipped at package root.
- Create: `src/framework-starter.js` — all framework-starter logic, exported for unit tests: `loadFrameworks`, `resolveFramework`, `buildC3Command`, `applyFrameworkHook`, `frameworkNextSteps`.
- Modify: `src/index.js` — import the module; branch in `main()`/`runCreate` resolution to the framework-starter path; merge manifest ids into `listTemplates` output and `--template` validation.
- Create: `tests/framework-starter.test.mjs` — `node:test` unit tests (tmp fixture dir, no network).
- Modify: `scripts/smoke-test.js` — real C3 scaffold per framework behind a `--network` flag.
- Modify: `package.json` — add `"frameworks.json"` to `files`; add `"test": "node --test tests/"`.

**Repo: `landing-page/` (Astro)**
- Create: `src/data/frameworks.json` — committed copy of the manifest.
- Create: `tests/frameworks-drift.test.mjs` — asserts the copy is byte-identical to the CLI source-of-truth (drift guard).
- Modify: `src/pages/templates/[slug].astro` — extend `getStaticPaths` to also emit `<id>-cloudflare` slugs from the manifest; branch render for framework pages.
- Create: `src/components/FrameworkStarter.astro` — the framework-page body + JSON-LD (`SoftwareApplication` + `HowTo`).

---

## Manifest shape (reference for all tasks)

```json
{
  "frameworks": [
    {
      "id": "nextjs",
      "label": "Next.js",
      "c3Framework": "next",
      "adapter": "@opennextjs/cloudflare",
      "searchTerms": ["nextjs cloudflare", "next.js cloudflare workers starter"],
      "hookEntry": "app/layout.tsx",
      "devCommand": "dev",
      "status": "ready"
    }
  ]
}
```

v1 rows: `nextjs`, `astro`, `react-router`, `nuxt`, `hono`, `sveltekit`. (`c3Framework` values: `next`, `astro`, `react-router`, `nuxt`, `hono`, `svelte`. Verify each against current C3 `--framework` choices during Task 7's real run; fix the value, not the architecture, if C3 renamed one.)

---

## Task 1: Manifest file

**Files:**
- Create: `packages/create-microservices-app/frameworks.json`

- [ ] **Step 1: Write the manifest**

Create `frameworks.json` with the six v1 rows using the shape above. `sveltekit` row uses `c3Framework: "svelte"`, `hookEntry: "src/routes/+layout.svelte"`, `adapter: "@sveltejs/adapter-cloudflare"`. `hono` uses `hookEntry: "src/index.ts"`. Fill `react-router` (`hookEntry: "app/root.tsx"`), `nuxt` (`hookEntry: "app.vue"`), `astro` (`hookEntry: "src/layouts/Layout.astro"`).

- [ ] **Step 2: Validate it parses**

Run: `node -e "const m=require('./packages/create-microservices-app/frameworks.json'); if(m.frameworks.length!==6) process.exit(1); console.log('ok',m.frameworks.map(f=>f.id).join(','))"`
Expected: `ok nextjs,astro,react-router,nuxt,hono,sveltekit`

- [ ] **Step 3: Commit**

```bash
git add packages/create-microservices-app/frameworks.json
git commit -m "feat(create-app): add frameworks.json manifest"
```

---

## Task 2: Manifest loader + framework resolution

**Files:**
- Create: `packages/create-microservices-app/src/framework-starter.js`
- Test: `packages/create-microservices-app/tests/framework-starter.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/framework-starter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFrameworks, resolveFramework } from "../src/framework-starter.js";

test("loadFrameworks returns the six v1 rows", () => {
  const rows = loadFrameworks();
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.id && r.c3Framework && r.hookEntry));
});

test("resolveFramework finds by id, null when absent", () => {
  assert.equal(resolveFramework("nextjs").c3Framework, "next");
  assert.equal(resolveFramework("does-not-exist"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/create-microservices-app && node --test tests/framework-starter.test.mjs`
Expected: FAIL — cannot find module `../src/framework-starter.js`.

- [ ] **Step 3: Implement loader**

```js
// src/framework-starter.js
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "frameworks.json");

export function loadFrameworks() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).frameworks;
}

export function resolveFramework(id) {
  return loadFrameworks().find((row) => row.id === id) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/framework-starter.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/framework-starter.js tests/framework-starter.test.mjs
git commit -m "feat(create-app): manifest loader + framework resolution"
```

---

## Task 3: Package-manager-aware C3 command builder

**Files:**
- Modify: `src/framework-starter.js`
- Test: `tests/framework-starter.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { buildC3Command } from "../src/framework-starter.js";

test("buildC3Command maps package managers to C3 invocation", () => {
  const row = { c3Framework: "next" };
  assert.deepEqual(buildC3Command("npm", row, "my-app"), {
    cmd: "npm",
    args: ["create", "cloudflare@latest", "my-app", "--", "--framework=next", "--no-deploy", "--no-git", "--no-open"],
  });
  assert.deepEqual(buildC3Command("pnpm", row, "my-app").args[0], "create");
  assert.equal(buildC3Command("bun", row, "my-app").cmd, "bunx");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/framework-starter.test.mjs`
Expected: FAIL — `buildC3Command` is not exported.

- [ ] **Step 3: Implement**

```js
// add to src/framework-starter.js
export function buildC3Command(packageManager, row, appName) {
  const c3Flags = [`--framework=${row.c3Framework}`, "--no-deploy", "--no-git", "--no-open"];
  if (packageManager === "npm") {
    return { cmd: "npm", args: ["create", "cloudflare@latest", appName, "--", ...c3Flags] };
  }
  if (packageManager === "bun") {
    return { cmd: "bunx", args: ["create-cloudflare@latest", appName, ...c3Flags] };
  }
  // pnpm, yarn: forward flags directly, no `--` separator
  return { cmd: packageManager, args: ["create", "cloudflare@latest", appName, ...c3Flags] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/framework-starter.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/framework-starter.js tests/framework-starter.test.mjs
git commit -m "feat(create-app): package-manager-aware C3 command builder"
```

---

## Task 4: Additive hook injection

**Files:**
- Modify: `src/framework-starter.js`
- Test: `tests/framework-starter.test.mjs`

`applyFrameworkHook(appDir, row, pm)` writes `microservices.config.json`, `README.microservices.md`, patches `package.json` (adds `microservices` script + CLI devDependency), and appends a banner comment to `hookEntry` if present. All operations additive; missing `hookEntry` → skip banner, do not throw.

- [ ] **Step 1: Write the failing test**

```js
import { applyFrameworkHook } from "../src/framework-starter.js";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

test("applyFrameworkHook injects config, readme, package.json script; tolerates missing hookEntry", () => {
  const dir = mkdtempSync(join(tmpdir(), "fw-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: {}, devDependencies: {} }));
  const row = { id: "nextjs", label: "Next.js", hookEntry: "app/layout.tsx", adapter: "@opennextjs/cloudflare" };

  applyFrameworkHook(dir, row, "npm"); // hookEntry absent -> must not throw

  assert.ok(existsSync(join(dir, "microservices.config.json")));
  const cfg = JSON.parse(readFileSync(join(dir, "microservices.config.json"), "utf8"));
  assert.deepEqual(cfg.modules, []);
  assert.match(readFileSync(join(dir, "README.microservices.md"), "utf8"), /microservices add/);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.ok(pkg.scripts.microservices, "microservices script added");
  assert.ok(Object.keys(pkg.devDependencies).some((d) => d.includes("microservices")), "CLI dep added");
});

test("applyFrameworkHook appends banner when hookEntry exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "fw-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: {}, devDependencies: {} }));
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app/layout.tsx"), "export default function L(){}");
  applyFrameworkHook(dir, { id: "nextjs", hookEntry: "app/layout.tsx", label: "Next.js" }, "npm");
  assert.match(readFileSync(join(dir, "app/layout.tsx"), "utf8"), /microservices\.sh/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/framework-starter.test.mjs`
Expected: FAIL — `applyFrameworkHook` not exported.

- [ ] **Step 3: Implement**

```js
// add to src/framework-starter.js
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PACKAGE = "@microservices-sh/cli"; // verify exact published name during Task 7

function runScript(pm, args) {
  return pm === "npm" ? `npm run microservices -- ${args}` : `${pm} microservices ${args}`;
}

export function applyFrameworkHook(appDir, row, pm) {
  writeFileSync(
    join(appDir, "microservices.config.json"),
    JSON.stringify({ modules: [], registry: "https://microservices.sh/registry" }, null, 2) + "\n",
  );

  const add = runScript(pm, "add <module>");
  writeFileSync(
    join(appDir, "README.microservices.md"),
    `# Add backend modules\n\nThis is a ${row.label} app on Cloudflare Workers, scaffolded with microservices.sh.\n\n` +
      `Add auth, billing, booking and more:\n\n\`\`\`bash\n${add}\n\`\`\`\n\n` +
      `List available modules:\n\n\`\`\`bash\n${runScript(pm, "modules list")}\n\`\`\`\n`,
  );

  const pkgPath = join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts = { ...pkg.scripts, microservices: "microservices" };
  pkg.devDependencies = { ...pkg.devDependencies, [CLI_PACKAGE]: "latest" };
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const entry = join(appDir, row.hookEntry ?? "");
  if (row.hookEntry && existsSync(entry)) {
    appendFileSync(entry, `\n// Powered by microservices.sh — add modules: ${add}\n`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/framework-starter.test.mjs`
Expected: PASS (banner + non-banner cases).

- [ ] **Step 5: Commit**

```bash
git add src/framework-starter.js tests/framework-starter.test.mjs
git commit -m "feat(create-app): additive framework hook injection"
```

---

## Task 5: Next-steps message

**Files:**
- Modify: `src/framework-starter.js`
- Test: `tests/framework-starter.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { frameworkNextSteps } from "../src/framework-starter.js";

test("frameworkNextSteps lists cd, dev, and project-local add command", () => {
  const lines = frameworkNextSteps("npm", "my-app", { devCommand: "dev", label: "Next.js" });
  assert.ok(lines.includes("cd my-app"));
  assert.ok(lines.some((l) => l.includes("npm run dev")));
  assert.ok(lines.some((l) => l.includes("npm run microservices -- add")));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/framework-starter.test.mjs`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

```js
// add to src/framework-starter.js
export function frameworkNextSteps(pm, appName, row) {
  const run = (s) => (pm === "npm" ? `npm run ${s}` : `${pm} ${s}`);
  return [
    `cd ${appName}`,
    pm === "npm" ? "npm install" : `${pm} install`,
    run(row.devCommand ?? "dev"),
    runScript(pm, "add <module>"),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/framework-starter.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/framework-starter.js tests/framework-starter.test.mjs
git commit -m "feat(create-app): framework starter next-steps message"
```

---

## Task 6: Wire framework-starter mode into the CLI

**Files:**
- Modify: `src/index.js` (resolution path in `main()` ~`:552`; `listTemplates`/validation ~`:554`; next-steps printer)
- Modify: `package.json` (`files`, `test` script)

- [ ] **Step 1: Read the integration points**

Read `src/index.js` around lines 145–175 (arg parsing/`--template`), 511–560 (`nextCommands`, repo-template branch, `TEMPLATE_NOT_FOUND`). Confirm where `allTemplates` is assembled and where the repo-template copy happens.

- [ ] **Step 2: Add manifest ids to template listing + validation**

Import at top of `src/index.js`:
```js
import { loadFrameworks, resolveFramework, buildC3Command, applyFrameworkHook, frameworkNextSteps } from "./framework-starter.js";
```
Where `allTemplates` is built (near `:554`), append framework rows so `--template nextjs` passes validation and `--help`/guided listing shows them:
```js
const frameworkTemplates = loadFrameworks().map((row) => ({
  id: row.id, name: `${row.label} (Cloudflare starter)`, status: row.status, summary: `${row.label} on Cloudflare Workers — empty starter, add modules via microservices.sh.`,
}));
// merge frameworkTemplates into the existing allTemplates array
```

- [ ] **Step 3: Branch to the framework-starter path**

Before the `isRepoTemplate` branch (~`:552`), add:
```js
const frameworkRow = resolveFramework(flags.template);
if (frameworkRow) {
  const { cmd, args } = buildC3Command(packageManager, frameworkRow, appName);
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: USER_CWD });
  if (result.status !== 0) {
    process.stderr.write(`\nC3 scaffold failed (exit ${result.status}). See output above.\n`);
    process.exit(result.status ?? 1);
  }
  const appDir = resolve(USER_CWD, appName);
  applyFrameworkHook(appDir, frameworkRow, packageManager);
  process.stdout.write("\nNext steps:\n" + frameworkNextSteps(packageManager, appName, frameworkRow).map((l) => `  ${l}`).join("\n") + "\n");
  return;
}
```
(Adjust `appName`/`packageManager`/`USER_CWD` variable names to match the surrounding code.)

- [ ] **Step 4: Ship the manifest**

In `package.json`, add `"frameworks.json"` to the `files` array and add `"test": "node --test tests/"` to `scripts`.

- [ ] **Step 5: Verify the bundle builds and lists frameworks**

Run: `cd packages/create-microservices-app && pnpm run build && node dist/index.js --help`
Expected: build succeeds (`node --check` passes); help output lists `nextjs`, `astro`, `react-router`, `nuxt`, `hono`, `sveltekit` among templates.

- [ ] **Step 6: Verify unknown framework still errors cleanly**

Run: `node dist/index.js my-app --template not-a-framework`
Expected: template-not-found error listing available ids (existing pattern), non-zero exit.

- [ ] **Step 7: Commit**

```bash
git add src/index.js package.json
git commit -m "feat(create-app): wire framework-starter template mode"
```

---

## Task 7: Real C3 smoke test (network)

**Files:**
- Modify: `scripts/smoke-test.js`

- [ ] **Step 1: Add a network-gated per-framework scaffold check**

Extend `scripts/smoke-test.js`: when invoked with `--network`, for each manifest row, run the built CLI (`dist/index.js`) into a fresh tmp dir and assert: (a) `microservices.config.json` exists with `modules: []`, (b) `README.microservices.md` contains `microservices add`, (c) `package.json` has the `microservices` script. Skip the loop (log "skipped: no --network") when the flag is absent so offline/CI-without-network runs stay green.

```js
// pseudocode shape — match existing smoke-test.js style
const NETWORK = process.argv.includes("--network");
if (!NETWORK) { console.log("framework smoke: skipped (pass --network to run)"); }
else {
  for (const row of loadFrameworks()) {
    const dir = mkdtempSync(join(tmpdir(), `smoke-${row.id}-`));
    const r = spawnSync("node", [DIST, "app", "--template", row.id, "--package-manager", "npm"], { cwd: dir, stdio: "inherit" });
    assert.equal(r.status, 0, `${row.id} scaffold failed`);
    const appDir = join(dir, "app");
    assert.ok(existsSync(join(appDir, "microservices.config.json")));
    // ...assert README + package.json script
    console.log(`framework smoke ok: ${row.id}`);
  }
}
```

- [ ] **Step 2: Run the network smoke test for one framework first**

Run: `cd packages/create-microservices-app && pnpm run build && node scripts/smoke-test.js --network`
Expected: each framework scaffolds and asserts pass. **If a `c3Framework` value is rejected by C3**, correct that value in `frameworks.json` (C3 may have renamed it) and re-run — fix data, not architecture.

- [ ] **Step 3: Run the non-network suite stays green**

Run: `node scripts/smoke-test.js`
Expected: prints the skip line, exits 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-test.js frameworks.json
git commit -m "test(create-app): network-gated C3 framework smoke tests"
```

---

## Task 8: Landing-page manifest copy + drift guard

**Files:** (repo `landing-page/`)
- Create: `src/data/frameworks.json`
- Create: `tests/frameworks-drift.test.mjs`

- [ ] **Step 1: Copy the manifest**

Copy `microservices-sh/packages/create-microservices-app/frameworks.json` → `landing-page/src/data/frameworks.json` verbatim.

- [ ] **Step 2: Write the drift-guard test**

```js
// landing-page/tests/frameworks-drift.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("landing manifest matches CLI source of truth", () => {
  const local = readFileSync(resolve("src/data/frameworks.json"), "utf8");
  const source = readFileSync(
    resolve("../microservices-sh/packages/create-microservices-app/frameworks.json"), "utf8",
  );
  assert.equal(local, source, "frameworks.json drift — re-copy from the CLI package");
});
```
(If CI clones repos separately so the sibling path is absent, guard with `existsSync` and skip — the test only enforces drift when both repos are checked out together, which is the dev layout here.)

- [ ] **Step 3: Run it**

Run: `cd landing-page && node --test tests/frameworks-drift.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit (in landing-page repo)**

```bash
cd landing-page && git add src/data/frameworks.json tests/frameworks-drift.test.mjs
git commit -m "feat: vendor frameworks.json manifest + drift guard"
```

---

## Task 9: SEO framework pages (Astro)

**Files:** (repo `landing-page/`)
- Modify: `src/pages/templates/[slug].astro`
- Create: `src/components/FrameworkStarter.astro`

- [ ] **Step 1: Read the existing template page**

Read `src/pages/templates/[slug].astro` to learn its `getStaticPaths` shape, how it loads product-template data, and the layout/components it uses. Match that style.

- [ ] **Step 2: Emit framework slugs from getStaticPaths**

In `[slug].astro`, import the manifest and add a path per framework with slug `<id>-cloudflare`, passing a `framework` prop:
```astro
import frameworks from "../../data/frameworks.json";
// inside getStaticPaths, concat to the existing returned array:
const fwPaths = frameworks.frameworks.map((row) => ({
  params: { slug: `${row.id}-cloudflare` },
  props: { framework: row },
}));
```
In the page body, branch: if `Astro.props.framework` is set, render `<FrameworkStarter framework={framework} />`; else render the existing product-template view unchanged.

- [ ] **Step 3: Build the FrameworkStarter component**

Create `src/components/FrameworkStarter.astro`: H1 `"<label> on Cloudflare Workers — Starter Template"`, the install command `npx create-microservices-app my-app --template <id>`, a "what's wired" section naming the adapter, a "Add backend modules" upsell linking to product templates, and a per-framework unique paragraph (adapter note / gotcha) to avoid thin content. Emit JSON-LD `SoftwareApplication` + `HowTo` in a `<script type="application/ld+json">`.

- [ ] **Step 4: Build the site**

Run: `cd landing-page && npm run build`
Expected: build succeeds; `dist/templates/nextjs-cloudflare/` (and the other five) exist.

- [ ] **Step 5: Verify a page renders the funnel content**

Run: `grep -rl "create-microservices-app my-app --template nextjs" dist/templates/`
Expected: matches the generated `nextjs-cloudflare` page.

- [ ] **Step 6: Commit (in landing-page repo)**

```bash
cd landing-page && git add src/pages/templates/[slug].astro src/components/FrameworkStarter.astro
git commit -m "feat: programmatic SEO pages for framework cloudflare starters"
```

---

## Done criteria

- `node --test tests/` green in both repos; `node dist/index.js --help` lists six frameworks; `--network` smoke scaffolds each framework with the hook applied.
- `landing-page` build emits one `/templates/<id>-cloudflare` page per manifest row with install command, adapter note, module upsell, and valid JSON-LD.
- Adding a 7th framework = one `frameworks.json` row in both repos (drift guard enforces parity) — no code change.
