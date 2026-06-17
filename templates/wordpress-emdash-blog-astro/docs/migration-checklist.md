# Migration Checklist

## Before Import

- Install the official EmDash Exporter plugin on the WordPress source site.
- Capture the active `theme.zip`; capture the child theme ZIP if a child theme is active.
- Run `npm run microservices -- wp migrate --source <wordpress-url> --theme ./theme.zip`.
- Run `npm run microservices -- wp probe --source <wordpress-url> --username <user> --password-prompt --out migration-reports/wp-source-probe.json`.
- Save the probe report outside git or in ignored migration artifacts.
- Run `npm run microservices -- wp analyze-theme`.
- Run `npm run microservices -- wp plan`.
- Review WooCommerce/custom post type warnings.
- Keep a WXR export as fallback.
- Keep the original WordPress site online.

## Import

- Start local dev with `npm run dev`.
- Open `/_emdash/admin`.
- Complete EmDash setup.
- Import content/media using the EmDash WordPress import flow.
- Run `npm run microservices -- wp convert-theme --pages /,/blog,/sample-post`.
- Convert the captured WordPress theme into Astro layouts/components using `.migration/theme-conversion.json` and the `wordpress-theme-to-astro` skill.
- Review raw HTML blocks and shortcode warnings.

## Verify

- Compare post, page, media, category, and tag counts.
- Run `npm run microservices -- wp capture --rebuilt http://localhost:4321 --run`.
- Compare source and converted screenshots for home, blog index, single post, category, tag, author, and top pages.
- Run `npm run microservices -- wp diff-theme`.
- Fill manual score sections in `migration-reports/theme-parity.json`.
- Run `npm run microservices -- wp validate-theme`.
- Check the home page and blog index.
- Open the top 20 old URLs.
- Confirm `/rss.xml`, `/sitemap.xml`, and `/robots.txt`.
- Confirm canonical URLs use the final domain.

## Cutover

- Deploy to Cloudflare Workers.
- Set `EMDASH_SITE_URL` or `SITE_URL`.
- Apply redirect rules.
- Switch DNS.
- Submit the new sitemap.
- Monitor 404s.
