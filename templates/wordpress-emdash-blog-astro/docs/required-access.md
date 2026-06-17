# Required Access

## Standard Migration

- Public WordPress URL.
- Temporary WordPress admin user or Application Password.
- Official EmDash Exporter plugin installed on the source site.
- Active WordPress `theme.zip`.
- Child theme ZIP, when a child theme is active.
- Live site access for visual crawl and screenshot comparison.

## Content-Only Migration

- Public WordPress URL.
- Temporary WordPress admin user or Application Password.
- Official EmDash Exporter plugin or WordPress WXR export from `Tools > Export > All content`.

This mode does not preserve the WordPress design. It uses the default Astro/EmDash blog template.

## Recommended For All Modes

- `wp-content/uploads` backup if media URLs are private, hotlink-blocked, or unstable.
- WordPress permalink settings.
- Active theme name.
- Active plugin list.
- Current sitemap URL, if available.
- DNS access for cutover.
- Search Console access for top URL validation.

## Advanced

- Database backup.
- Full `wp-content/` backup.
- Page builder exports for Elementor, Divi, WPBakery, Beaver Builder, or similar tools.
- Custom plugin source for manual rebuild assessment.

Application Passwords are temporary secrets. Revoke them after migration verification.
