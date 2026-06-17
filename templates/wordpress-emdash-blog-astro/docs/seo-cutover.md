# SEO Cutover

## Preserve

- Slugs and permalink patterns where practical.
- Canonical URLs.
- Page titles and descriptions.
- RSS feed URL with redirects from old feed locations.
- Sitemap URL with redirects if the old sitemap path differs.

## Validate

- Old top URLs return `301` to the new equivalent.
- New pages return `200`.
- Missing unsupported commerce/application URLs return intentional redirects or `410`.
- `robots.txt` points to the new sitemap.
- Search Console has the new sitemap.

## Sitemap Fallback

If `/wp-sitemap.xml` returns `404`, use a crawl, Search Console export, analytics top URLs, or a WordPress admin export as the source of truth for redirects and parity pages.
