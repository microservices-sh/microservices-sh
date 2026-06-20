# Module Preview — Standard & Audit (2026-06-20)

The "preview standard" established with `marketing-research`, audited across all modules.

## The standard (4 dimensions)

1. **`surfaces` in `module.json`** — declares admin nav + agentic tools (+ approval gating). Drives nav and the generic preview.
2. **`reference-ui/README.md`** — prose spec of the Admin/Visitor/Agentic surface.
3. **`reference-ui/Preview.svelte`** — *optional* rich, interactive surface built on the shared DS. Overrides the generic preview. Reused by both the harness and a template route.
4. **Generic-preview-ready metadata** — name/summary/class/status/permissions/rpc/events, so any module renders a polished baseline preview from `module.json` even without a custom component.

## Audit — 28 modules

| Dimension | Coverage |
|---|---|
| `surfaces` declared | **28 / 28** ✅ universal |
| `reference-ui/README.md` | **25 / 28** — missing: `ai-gateway`, `decision`, `research` |
| `reference-ui/Preview.svelte` | **1 / 28** (`marketing-research`) |
| Inspectable in the harness | **28 / 28** — generic preview covers the 27 without a custom one |

## Decision — one change, all modules

Rather than hand-build 27 previews, the `GenericPreview` was **elevated to the marketing-research polish** (white "paper" cards, clear `surfaces` / `contract` / `permissions` sections, staggered reveal, the "ship a Preview.svelte for a rich surface" hint). So **every module now has a consistent, polished, explanatory preview** from its `module.json`, and a custom `Preview.svelte` is an opt-in upgrade.

Inspect any module one at a time: `packages/module-preview` → `?module=<id>` (the switcher in the topbar).

## Gaps & recommendations

**reference-ui README (3):** `ai-gateway`, `decision`, `research` lack one — these are the **draft research-pillar modules still being built**; add a README when they productionize (owner's call — left untouched here).

**Custom `Preview.svelte` candidates** (genuinely interactive surfaces worth the rich treatment, in rough priority):
- `booking`, `customer`, `invoice`, `support-ticket`, `forms-intake`, `image-generation`, `ads-manager`, `payment`, `calendar-google`

**Fine on the generic preview** (infra / sink / platform — metadata view is sufficient):
- `audit-log`, `webhook-delivery`, `idempotency`, `gateway`, `ai-gateway`, `org-team-rbac`, `jobs-workflows`, `notifications-inapp`, `admin-shell`, `auth`, `identity`, `passkey-auth`, `email`, `file-media`

## Net
The standard is essentially met: surfaces universal, reference-ui 25/28, and **every** module is now inspectable with a polished preview. The remaining work is opt-in rich previews for the user-facing modules, plus 3 reference-ui READMEs on the draft modules.
