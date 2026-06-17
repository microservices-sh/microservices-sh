# WordPress to EmDash Blog

Astro + EmDash template for migrating WordPress blogs and content sites to Cloudflare Workers, D1, and R2.

Use this for standard WordPress blog migrations: content extraction with the official EmDash Exporter plus theme ZIP conversion into Astro/EmDash.

Do not use this template for WooCommerce, membership, LMS, or custom PHP application migrations.

## Standard Flow

Standard design-preserved migration requires:

- WordPress URL.
- Temporary WordPress admin user or Application Password.
- Official EmDash Exporter plugin installed.
- Active `theme.zip`.
- Child `theme.zip`, when a child theme is active.

Start the guided CLI flow:

```bash
npm run microservices -- wp migrate --source https://example.com --theme ./theme.zip
```

The command writes:

```text
.migration/migration-config.json
.migration/theme-manifest.json
.migration/migration-plan.json
.migration/migration-plan.md
```

Use content-only mode only when design parity is not required:

```bash
npm run microservices -- wp migrate --source https://example.com --content-only
```

## Source Probe

```bash
npm run microservices -- wp probe \
  --source https://example.com \
  --username admin \
  --password-prompt \
  --out migration-reports/wp-source-probe.json
npm run wp:verify -- --report migration-reports/wp-source-probe.json
npm run microservices -- wp plan --report migration-reports/wp-source-probe.json
```

Never pass the Application Password as a command argument. Use `--password-prompt` locally or `--password-stdin` in CI, and revoke the password after verification.

## WordPress Import

1. In WordPress, install and verify the official EmDash Exporter plugin.
2. Start the generated app with `npm run dev`.
3. Open `/_emdash/admin` and complete EmDash setup.
4. Import content/media using EmDash's WordPress import flow.
5. Run `npm run microservices -- wp analyze-theme` to validate and inventory the captured theme ZIP.
6. Run `npm run microservices -- wp convert-theme --pages /,/blog,/sample-post` to create the AI-agent handoff.
7. Convert the captured theme ZIP into Astro layouts/components using the `wordpress-theme-to-astro` skill.
8. Run `npm run microservices -- wp capture --rebuilt http://localhost:4321 --run`.
9. Run `npm run microservices -- wp diff-theme`, fill any manual score sections in `migration-reports/theme-parity.json`, then run `npm run microservices -- wp validate-theme`.
10. Review warnings for raw HTML blocks, unsupported shortcodes, media failures, and custom post types.

## Deploy

Create the Cloudflare resources and update `wrangler.jsonc` before the first production deploy:

```bash
npx wrangler d1 create wordpress-emdash-blog-astro-db
npx wrangler r2 bucket create wordpress-emdash-blog-astro-media
npm run cf:types
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the D1 UUID returned by `wrangler d1 create`.

```bash
npm run build
npm run deploy
```

Set `EMDASH_SITE_URL` or `SITE_URL` before production deploy so passkeys, canonical URLs, RSS, and EmDash-generated sitemap/robots routes use the final origin.
