# API Boundary

## EmDash-Owned Surface

EmDash owns CMS administration, passkey login, content import, media import, WordPress WXR parsing, schema management, and CMS REST/MCP endpoints.

## Template-Owned Surface

The template owns public Astro routes, RSS, sitemap, robots.txt, migration docs, and source verification scripts.

## microservices.sh-Owned Surface

No runtime microservices.sh module is required for v0. Future forms, email, audit log, or newsletter flows should be added as separate modules rather than embedded in this template.

## Source Probe Boundary

The WordPress probe scripts only read REST metadata. They must not mutate WordPress, store credentials, or import commerce data.
