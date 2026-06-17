# Plugin Support Matrix

## Supported In v0

| WordPress feature | Handling |
| --- | --- |
| Posts | Import through the official EmDash Exporter; WXR fallback. |
| Pages | Import through the official EmDash Exporter; WXR fallback. |
| Media | Import through EmDash media import and R2 storage. |
| Categories/tags | Import as taxonomies. |
| Gutenberg core blocks | Convert through EmDash WordPress importer. |
| Classic editor HTML | Convert or preserve as sanitized content. |
| Yoast/RankMath basic metadata | Map where available during import. |

## Report Only

| WordPress feature | Handling |
| --- | --- |
| Elementor/Divi/Beaver Builder | Likely HTML/manual redesign. |
| ACF complex fields | Import as JSON/manual review. |
| Shortcodes | Preserve/report for manual conversion. |
| Comments | Optional archive decision. |
| Custom post types | Report and exclude by default. |

## Unsupported

| WordPress feature | Handling |
| --- | --- |
| WooCommerce | Excluded from this template. |
| Orders/customers/payments | Excluded. |
| Membership/paywall plugins | Excluded. |
| LMS/community plugins | Excluded. |
| Custom PHP plugin behavior | Rebuild as first-party code or module. |
