# @microservices-sh/module-preview

Standalone harness to **inspect one module at a time** in the canonical app shell
(`@microservices-sh/ui` `AppShell`) — no template scaffold, no auth, no bindings.
Modules are distributed copy-in (a subset per app), so the harness mirrors that:
one module, selected via `?module=<id>` (or the topbar switcher).

```bash
npm run dev          # → http://localhost:5173 ?module=<id>
```

## How it works (everything is auto-discovered)

`App.svelte` has **no per-module code**. For the selected `<id>` it resolves, in order:

| Layer | Path | Required? | What it gives |
|---|---|---|---|
| Metadata | `modules/<id>/module.json` | yes (every module has it) | nav + the `GenericPreview` (surfaces / contract / permissions) |
| Rich surface | `modules/<id>/reference-ui/Preview.svelte` | optional | the module's real DS-built surface (`./preview` export) |
| Interactive wrapper | `packages/module-preview/src/wrappers/<id>.svelte` | optional | demo data, run handler, test config — renders the Preview |
| Live backend | `packages/module-preview/src/server/<id>.ts` | optional | dev-only Node handler behind `POST /api/<id>/run` |

A module with **none** of the optional pieces still renders a polished metadata
preview (`GenericPreview`). Each piece you add upgrades it — and needs **zero
edits to `App.svelte`**.

## Add a preview for a new module

1. **Nothing** — it already shows in the switcher with the generic metadata preview.
2. **A rich surface:** add `modules/<id>/reference-ui/Preview.svelte` (presentational,
   built on `@microservices-sh/ui`, takes data + handlers via props/snippets) and
   export it as `./preview` in the module's `package.json`. This same component is
   reused by template routes — one source of truth.
3. **Make it interactive in the harness:** add `src/wrappers/<id>.svelte` — it owns
   the module's demo data, an `onrun` that POSTs to `/api/<id>/run`, and any
   test-only config (e.g. a BYOK key). Keep test-only concerns here, *not* in the
   shared `Preview.svelte`.
4. **Run the real module live (dev):** add `src/server/<id>.ts` exporting
   `research(topic, channels, opts)` (rename per module). It runs in Node via vite's
   `ssrLoadModule`, so it can spawn engines / call ai-gateway with a BYOK key.

`marketing-research` is the worked example of all four. See `MODULE-PREVIEW-AUDIT.md`
for the cross-module standard + which modules warrant a rich Preview.
