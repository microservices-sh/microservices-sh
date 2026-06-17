# Agent Guide: WordPress to EmDash Blog

This template migrates WordPress content sites to Astro + EmDash on Cloudflare Workers.

## Boundaries

- Migrate posts, pages, media, categories, tags, authors, basic SEO metadata, RSS, and sitemap.
- Report WooCommerce, products, payments, orders, customers, memberships, LMS, and custom PHP plugins as unsupported.
- Never store WordPress Application Passwords in source, docs, config, package scripts, or reports.
- Standard migration requires the official EmDash Exporter plugin plus active `theme.zip`.
- Use WXR as a fallback, not the primary migration path.
- Content-only migration is allowed only when the operator explicitly accepts the default Astro/EmDash design.

## Normal Flow

1. Run `npm run microservices -- wp migrate --source <wordpress-url> --theme ./theme.zip`.
2. Run `npm run microservices -- wp probe --source <wordpress-url> --username <user> --password-prompt --out migration-reports/wp-source-probe.json`.
3. Run `npm run wp:verify -- --report migration-reports/wp-source-probe.json`.
4. Run `npm run microservices -- wp plan --report migration-reports/wp-source-probe.json`.
5. Run `npm run microservices -- wp analyze-theme`.
6. Run `npm run microservices -- wp convert-theme --pages /,/blog,/sample-post`.
7. Convert `theme.zip` with the `wordpress-theme-to-astro` skill using `.migration/theme-conversion.json`.
8. Start local dev with `npm run dev`.
9. Import content/media in `/_emdash/admin`.
10. Run `npm run microservices -- wp capture --rebuilt http://localhost:4321 --run`.
11. Run `npm run microservices -- wp diff-theme`, fill any manual score sections in `migration-reports/theme-parity.json`, then run `npm run microservices -- wp validate-theme`.
12. Review unsupported warnings and visual parity before deploy/cutover.

## Source-Specific Notes

Record customer-specific observations in project-local migration reports, not reusable template docs or package scripts. Keep WooCommerce and custom post type exclusions explicit in `migration-reports/` and revoke temporary Application Passwords after testing.
