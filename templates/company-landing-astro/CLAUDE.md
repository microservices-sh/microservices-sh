# Customizing this site (agent playbook)

This is a static **Astro** company landing page. All copy and the brand accent
are **data**, not code. To make it the customer's site, you edit one file.

## The one rule

**Edit `src/content.json` only.** Do not edit components, layouts, pages, or
styles — they read from that JSON. The shape, field limits, and per-field hints
are defined in `content.schema.json` (JSON Schema, draft 2020-12).

## Workflow

1. **Read the contract**: `content.schema.json`. Every field has a
   type, length limit, and an `x-hint` explaining what it's for and how it renders.
   `x-microservices` at the top lists the write target, the verify command, and
   the paths you must not touch.
2. **Edit `src/content.json`** to the customer's company. The existing values are
   a valid, working example — mutate them, keep the structure.
   - Respect `maxLength` and array `minItems`/`maxItems` (features, process steps,
     and pricing plans are **exactly 3** — the layouts are fixed grids).
   - `features[].icon` must stay one of: `engineering`, `design`, `performance`.
   - Mark **exactly one** pricing plan `featured: true`.
   - Links (`href`) are in-page anchors (`#features`), `mailto:`, or `https://` URLs.
3. **Set the brand color** (optional): `theme.accent` as `#rrggbb`. One hex drives
   the whole accent system (the darker ink + the wash derive automatically). Pick a
   color with enough contrast on the warm-paper background (`#faf8f4`). Omit to keep
   the default terracotta.
4. **Verify**: run `npm run validate` for a fast schema check with precise,
   path-pointed errors (e.g. `hero.title: exceeds maxLength 60 (is 74)`). It also
   runs automatically before every `npm run build`, which must succeed. Then
   `npm run dev` to preview.

## What you cannot change here (this phase)

- **Fonts** are fixed (Fraunces display / Hanken Grotesk body).
- **Section structure** is fixed — you can change the words, not add/remove sections.
- **Images**: client logos render as text wordmarks; there are no image assets.

If the customer needs structural changes, that's a code edit to the components —
out of scope for content customization.

## Don't

- Don't edit `src/site.config.ts` — it only types `content.json`.
- Don't add fields not in the schema (`additionalProperties` is false; `npm run
  validate` — and therefore `npm run build` — will fail on any extra field).
- Don't touch `src/styles/tokens.css` for brand color — use `theme.accent` instead.
