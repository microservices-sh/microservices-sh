# Company Landing (Astro)

A static, editorial company landing page. Refined light design, content-driven, zero backend. Built with Astro (`output: "static"`) — deploys as plain files anywhere.

## Make it yours

1. **Interactive intake** — answer the short fields in `intake.schema.json` when using a setup wizard or agent.
2. **Content** — edit `src/content.json`. Company name, nav, hero, features, process, pricing, testimonial, FAQ, footer, and the brand accent all live there. You should rarely touch the components.
3. **Theme** — advanced visual changes live in `src/styles/tokens.css`; for normal branding, change `theme.accent` in `src/content.json`.
4. **Fonts** — Fraunces (display) + Hanken Grotesk (body) + IBM Plex Mono (labels), loaded in `src/layouts/Base.astro`. Replace the Google Fonts link + `--font-*` tokens to change them.

## Run

```bash
npm install
npm run dev        # preview at localhost:4321
npm run build      # static output → ./dist
node scripts/microservices.js check --json   # validate template files
```

## Deploy

`npm run build` produces a static `./dist`. Upload to Cloudflare Pages/Workers static assets, Netlify, Vercel static, S3 — anywhere. No server, no adapter.

## Adding backend later

This template is intentionally **module-less** (a marketing site). If you later need auth, payments, a real contact form, etc., generate a business template (e.g. `booking-sveltekit`) or add the Cloudflare adapter and wire microservices.sh modules. See https://microservices.sh.
