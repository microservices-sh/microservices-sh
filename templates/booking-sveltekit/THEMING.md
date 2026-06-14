# Theming this template

The UI is built with **Tailwind CSS v4** in CSS-first mode. There is no
`tailwind.config.js` — the entire design system lives in one place:

```
src/app.css  →  @theme { … }
```

## Re-brand in 30 seconds

Open `src/app.css` and edit the tokens in the `@theme` block.

| Want to change… | Edit token(s) |
| --- | --- |
| Brand color (buttons, links, pills, active nav) | `--color-accent`, `--color-accent-strong`, `--color-accent-soft`, `--color-accent-line` |
| Page background | `--color-bg` |
| Card / panel background | `--color-surface` |
| Body text color | `--color-ink`, `--color-muted` |
| Borders | `--color-line`, `--color-line-strong` |
| Heading font | `--font-display` |
| Body font | `--font-sans` |
| Corner roundness | `--radius-card`, `--radius-control` |
| Shadows | `--shadow-sm`, `--shadow-card`, `--shadow-pop` |

Every token also generates Tailwind utilities, so `--color-accent` gives you
`bg-accent`, `text-accent`, `border-accent`, `ring-accent`, etc.

### Example: switch from pine green to indigo

```css
@theme {
  --color-accent: #4f46e5;
  --color-accent-strong: #4338ca;
  --color-accent-soft: #eef2ff;
  --color-accent-line: #c7d2fe;
}
```

Save. Dev server hot-reloads; every button, link, pill, and active nav item
updates. No markup changes needed.

### Changing fonts

Fonts load in `src/app.html` (Google Fonts `<link>`). Swap the font there, then
point `--font-display` / `--font-sans` at the new family in `app.css`.

## How the styles are organized

- `@theme` — design tokens (the only thing most people edit).
- `@layer base` — element defaults (`body`, `h1`, `a`, `code`, …).
- `@layer components` — reusable classes (`.panel`, `.button`, `.field`, `.pill`,
  `.stat-card`, …) built with `@apply` from the tokens. Adjust these to change a
  component everywhere it appears.

## Two ways to style

1. **Component classes** (`class="panel"`, `class="button secondary"`) — for the
   repeated primitives. Change them once in `@layer components`.
2. **Utilities inline** (`class="flex items-center gap-2.5 text-accent"`) — for
   one-off layout and tweaks, e.g. the feature checklist on the home page.

Mix freely. Both read from the same tokens, so the app stays consistent.

## Status pills

Booking statuses are colored by `src/lib/status.ts` → `.pill`, `.pill.is-warn`,
`.pill.is-danger`, `.pill.is-muted`. Edit the buckets in that file to match your
own status vocabulary.
