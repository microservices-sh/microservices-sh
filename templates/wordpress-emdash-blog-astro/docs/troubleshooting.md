# Troubleshooting

## Application Password Fails

- Confirm the username is correct.
- Copy the Application Password with spaces preserved or removed; WordPress accepts either in Basic Auth.
- Confirm the user still exists and the password has not been revoked.
- Confirm security plugins are not blocking Basic Auth.

## Sitemap Missing

Run the probe anyway. Use WXR plus a crawler/exported URL list for redirect planning.

## WooCommerce Detected

Continue only as a content-only migration. Do not import products, orders, customers, subscriptions, payment settings, or tax/shipping rules in this template.

## Media Import Failures

- Keep the old WordPress host online until all media is verified.
- Provide an uploads ZIP when hotlinking or private media blocks downloads.
- Re-run EmDash media import; imports should be idempotent by media identity/hash.
