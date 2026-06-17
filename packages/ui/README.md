# @microservices-sh/ui

Canonical design-system components — the **web-portal look** (IBM Plex, slate ink, brand green, light + dark). Distributed **shadcn-style**: you copy components into your repo and own them, rather than taking a compiled dependency. This is deliberate — the consuming repos (web-portal, admin, the inner-monorepo templates) run **different Vite/TypeScript majors**, and a copied `.svelte` source compiles cleanly under each repo's own toolchain, where a shared compiled package would version-lock.

## How it works

- **Tokens** (`styles/tokens.css`): framework-agnostic `:root` CSS custom properties (not Tailwind `@theme`), with a `:root[data-theme="dark"]` override. Components read `var(--color-…)`, so they follow each app's theme automatically.
- **Components** (`components/*.svelte`): self-contained — scoped `<style>` + token vars. No Tailwind utility dependency, no build step.

## CLI

```bash
# from a consuming app (or pass --dir <path>):
node <path-to>/packages/ui/bin/ui.mjs list
node <path-to>/packages/ui/bin/ui.mjs add Button Card Badge
node <path-to>/packages/ui/bin/ui.mjs sync     # pull updates for everything added
```

Files land in `src/lib/ui/` (`tokens.css`, `<Name>.svelte`, `index.ts`, `.msh-ui.json`).
Then import the tokens once and use the components:

```css
/* src/app.css */  @import "$lib/ui/tokens.css";
```
```svelte
<script>import { Button, Card } from "$lib/ui";</script>
<Button variant="primary">Save</Button>
```

## Dark mode

Set `data-theme="dark"` on `<html>` (e.g. from a store/toggle). All tokens flip; components need no change.

## Components

Button · Card · Badge · Alert · Field · Eyebrow (more ported from web-portal in later phases: PageHeader, Metric, UsageBar, Logo, NavProgress).
