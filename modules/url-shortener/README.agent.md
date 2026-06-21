# URL Shortener Module Agent Guide

Use this module through `@microservices-sh/url-shortener`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/url-shortener check:spec`.
5. Run `pnpm --filter @microservices-sh/url-shortener build` after source edits.

Mutation rules:

- Validate the destination URL before creating a link.
- Do not shorten localhost or private-network URLs.
- Keep `api`, `stats`, `admin`, `login`, `signup`, `health`, and `favicon` reserved.
- Resolve through the service when click analytics should be recorded.
- Public redirect routes and KV caching belong in the app adapter, not in the module.
