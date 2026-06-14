# Framework Templates + SEO Funnel — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design), pending implementation plan
**Goal:** Discovery/funnel reach. Capture developers searching "<framework> cloudflare starter" via additional `create-microservices-app` entry points and programmatic SEO pages, then funnel them into the microservices.sh module ecosystem.

## Problem & Rationale

Existing templates (`booking-sveltekit`, `client-portal-sveltekit`, `saas-starter-sveltekit`) are **product templates** — opinionated, SvelteKit-coupled, module-wired (D1 migrations, auth-gating, lockfile). They are the moat but cover only the SvelteKit, vertical-product audience.

The request was "add all framework scaffolds (nextjs, sveltekit, astro, …)". Building full module-wired templates per framework is a combinatorial maintenance trap (N frameworks × M modules, each requiring a framework-specific port of the module SDK). Building **empty** scaffolds per framework duplicates Cloudflare's own `npm create cloudflare` (C3), which already scaffolds every framework with the correct adapter.

**Chosen strategy:** Do not re-implement framework scaffolding. Wrap C3 so it owns the framework + adapter (and their version churn), and inject a thin "hook home" so every empty scaffold has a path back to microservices.sh modules. Pair with programmatic SEO pages to capture the Google channel. Funnel reach is the objective; the hook is what converts reach into ecosystem entry.

## Non-Goals (YAGNI)

- No per-framework port of the module SDK / auth-gating / migrations.
- No vendored framework scaffolds (rejected: eats adapter churn across N frameworks).
- No interactive "add auth now? [y/N]" prompt during scaffold (v1 is README-only).
- No paid-ads work in this spec (organic/SEO only).
- Not "all" frameworks — a scoped v1 set, extensible by data row.

## Architecture

Two deliverables across two repos, sharing one source of truth.

```
microservices-sh/ (repo)
  packages/create-microservices-app/
    frameworks.json            ← SINGLE SOURCE OF TRUTH (id, c3Framework, adapter, searchTerms, hook)
    src/index.js               ← gains 3rd template mode: "framework starter"
    src/hooks/<framework>/      ← thin hook files injected over C3 output
    scripts/smoke-test.js       ← extended: scaffold + assert per framework

landing-page/ (repo)
  src/data/frameworks.json     ← copy/symlink of the manifest (build-time synced)
  src/pages/templates/[framework]-cloudflare  ← programmatic SEO page (N pages from manifest)
```

`frameworks.json` is the spine. Both the CLI (to drive C3 flags + hook injection) and the landing pages (to generate SEO routes) read it. One row added = one new CLI template + one new SEO page, no code change.

### `frameworks.json` schema (per row)

```json
{
  "id": "nextjs",
  "label": "Next.js",
  "c3Framework": "next",
  "adapter": "@opennextjs/cloudflare",
  "searchTerms": ["nextjs cloudflare", "next.js cloudflare workers starter"],
  "hookEntry": "app/layout.tsx",
  "status": "ready"
}
```

## Deliverable A — CLI Framework-Starter Mode

### Template resolution (3rd mode)

Current CLI has two modes: **repo templates** (`REPO_TEMPLATES`, copied verbatim from `templates/` and patched) and **procedural** (`generateProject` via sdk-internal). Add a third: **framework starters**, keyed off `frameworks.json`.

Resolution order in `main()` (around `src/index.js:552`): if `flags.template` matches a `frameworks.json` id → framework-starter path; else existing repo/procedural logic unchanged. Framework ids must not collide with existing template ids (validated at build).

### Flow

```
create-microservices-app --template nextjs <app>
  1. Look up row in frameworks.json (else: error listing available ids).
  2. spawnSync C3 (package-manager-aware, see mapping below):
        npm:  npm create cloudflare@latest <app> -- --framework=<c3Framework> --no-deploy --no-git --no-open
        pnpm: pnpm create cloudflare@latest <app> --framework=<c3Framework> --no-deploy --no-git --no-open
        yarn: yarn create cloudflare <app> --framework=<c3Framework> --no-deploy --no-git --no-open
        bun:  bunx create-cloudflare@latest <app> --framework=<c3Framework> --no-deploy --no-git --no-open
  3. Inject hook over the scaffold (additive only — no overwrite of C3
     framework files except one banner line in hookEntry):
        - microservices.config.json    (modules: [], registry URL)
        - patch package.json: add devDependency on the microservices CLI
          + a "microservices" script — so the advertised add command resolves
          (same project-local pattern as existing product templates).
        - README.microservices.md       ("Add auth/billing/booking:
                                           <pm-run> microservices add <module>")
        - additive banner comment/link in hookEntry route
  4. Print next-steps: cd, install, dev command, and the project-local
     `<pm-run> microservices add <module>` (NOT a global binary).
```

Package-manager `<pm-run>` form mirrors the existing `packageScriptCommand`
helper: `npm run microservices -- add <module>` for npm; `pnpm microservices
add <module>` / `yarn microservices add <module>` / `bun microservices add
<module>` otherwise.

### Boundaries / interfaces

- **C3 dependency** is a hard runtime dependency (network + npm required). Approved. On C3 spawn failure (offline, C3 error), fail loudly with the C3 exit output and a clear message — never silently fall back.
- The hook layer is additive: it adds new files (`microservices.config.json`, `README.microservices.md`), patches `package.json` (one devDependency + one script), and inserts one banner line in `hookEntry`. It must not otherwise edit C3's framework code. This keeps the CLI resilient to C3 scaffold changes.
- `microservices.config.json` written here is the same shape the rest of the toolchain reads, so a later `microservices add` works without migration.

### Error handling

- Unknown framework id → list available ids (reuse existing template-not-found pattern at `src/index.js:554`).
- C3 spawn non-zero exit → surface C3 stderr verbatim, exit non-zero.
- Missing `hookEntry` file after scaffold (C3 changed layout) → warn, skip banner injection, still write config + README (degrade, don't crash).

## Deliverable B — Programmatic SEO Pages

- **Generator:** one page template → N pages from `frameworks.json`. Built with **seo-programmatic** + **seo-page** skills; term mapping via **content-strategy** skill.
- **Route:** `/templates/<id>-cloudflare` (e.g. `/templates/nextjs-cloudflare`).
- **Target queries:** "<framework> cloudflare boilerplate/starter/template" from `searchTerms`.
- **Page content:** H1 with framework+Cloudflare, copy-paste `npx create-microservices-app --template <id>`, "what's wired" (adapter, Workers), the module upsell ("add auth/billing/booking"), links to product templates (booking/portal/SaaS).
- **Schema:** `SoftwareApplication` + `HowTo` JSON-LD.
- **Quality gate:** avoid thin/duplicate content — each page needs framework-specific copy (adapter notes, gotchas), not just a swapped name, or it risks Google thin-content penalty.

## Scope — v1 Frameworks

`nextjs, astro, react-router, nuxt, hono` + existing `sveltekit` (6 total). All C3-supported. `solid`, `qwik`, etc. = add a `frameworks.json` row later (no code change).

## Testing

- **CLI:** extend `scripts/smoke-test.js` — for each framework row: scaffold into a tmp dir, assert (a) hook files present, (b) `microservices.config.json` valid + empty modules, (c) `wrangler deploy --dry-run` (or `wrangler types`/build check) passes. Network-dependent; gate behind a flag/CI job if needed.
- **Landing:** build the site, assert N SEO pages render, validate JSON-LD schema, basic Lighthouse/SEO check.

## Risks

- **C3 flag/output drift** — C3 could rename `--framework` values or scaffold layout. Mitigation: hook layer is additive + degrades gracefully; smoke-test catches breakage early.
- **Thin SEO content** — N near-identical pages risk penalty. Mitigation: per-framework unique copy, not templated name-swaps.
- **Funnel leak** — empty scaffold with weak hook = gave away a C3 clone. Mitigation: the README hook + next-steps are the conversion surface; keep them prominent.

## Open Questions (resolved)

- Hook depth → **README-only v1** (no interactive prompt).
- C3 runtime dependency → **accepted**.
