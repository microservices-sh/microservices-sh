# CLI Workflow

## Standard Design-Preserved Migration

Use this for most customer migrations.

```bash
npm run microservices -- wp migrate --source https://example.com --theme ./theme.zip
```

Required inputs:

- WordPress URL.
- Temporary WordPress admin user or Application Password for probing/export.
- Official EmDash Exporter plugin installed.
- Active `theme.zip`.
- Child theme ZIP if the source uses a child theme.

Generated artifacts:

- `.migration/migration-config.json`
- `.migration/theme-manifest.json`
- `.migration/migration-plan.json`
- `.migration/migration-plan.md`

After the initial plan, run the authenticated probe:

```bash
npm run microservices -- wp probe \
  --source https://example.com \
  --username admin \
  --password-prompt \
  --out migration-reports/wp-source-probe.json
npm run wp:verify -- --report migration-reports/wp-source-probe.json
npm run microservices -- wp plan --report migration-reports/wp-source-probe.json
```

Do not pass the Application Password as a command argument. Use `--password-prompt` locally or `--password-stdin` in CI. Revoke it after migration verification.

## Content-Only Migration

Use this only when the customer accepts the default Astro/EmDash design.

```bash
npm run microservices -- wp migrate --source https://example.com --content-only
```

This mode can proceed without `theme.zip`, but the old WordPress layout is not preserved.

## Theme Intake

Add or replace the active theme ZIP:

```bash
npm run microservices -- wp add-theme ./theme.zip
```

Add a child theme ZIP:

```bash
npm run microservices -- wp add-theme ./child-theme.zip --child
```

The CLI copies the ZIP into `.migration/input/` and records size and SHA-256 in `.migration/theme-manifest.json`.

The same command also validates archive integrity and writes `.migration/theme-analysis.json`. Re-run analysis after replacing the ZIP:

```bash
npm run microservices -- wp analyze-theme
```

Analysis must find a WordPress theme root with `style.css`. It also records whether the source is a classic, block, or hybrid theme and warns about large archives, `node_modules`, `__MACOSX`, multiple theme roots, and generated dependencies.

## Theme Conversion

Generate the AI-agent handoff after probe and theme analysis:

```bash
npm run microservices -- wp convert-theme --pages /,/blog,/sample-post
```

This writes `.migration/theme-conversion.json`. Use the generated prompt with the `wordpress-theme-to-astro` skill. The command does not pretend to compile arbitrary PHP into Astro; it defines the pages, source artifacts, expected outputs, and parity report requirements for the coding agent.

## Capture And Validation

After the converted Astro app is running locally:

```bash
npm run dev
npm run microservices -- wp capture --rebuilt http://localhost:4321 --run
npm run microservices -- wp diff-theme
npm run microservices -- wp validate-theme
```

`wp capture` writes `.migration/capture-plan.json` and screenshot output directories. With `--run`, it captures screenshots using Playwright when available, otherwise Chrome CLI. If browser capture fails, it writes `migration-reports/capture-result.json` with `partial` or `blocked` status.

`wp diff-theme` compares captured PNG screenshots and writes `migration-reports/theme-parity.json`. The automated score covers screenshot similarity, geometry, route capture, and responsive capture completeness. Fill manual score sections for design tokens, interactions, accessibility/performance, and unsupported-surface reporting before launch.

`wp validate-theme` requires `migration-reports/theme-parity.json`, score `>=85`, and no critical failures before launch. Use `wp validate-theme --generate` to regenerate the parity report from captured screenshots and immediately enforce the same launch gate.

## Status

```bash
npm run microservices -- wp status
```

Use this before conversion, validation, deploy preview, and DNS cutover.

## Cloudflare Binding Types

After creating or renaming D1/R2 bindings in `wrangler.jsonc`, regenerate Worker binding types:

```bash
npm run cf:types
```

For production deploys, replace the placeholder D1 `database_id` in `wrangler.jsonc` with the UUID returned by:

```bash
npx wrangler d1 create wordpress-emdash-blog-astro-db
```
