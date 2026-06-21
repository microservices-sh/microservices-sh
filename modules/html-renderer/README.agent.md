# HTML Renderer Module Agent Guide

Use this module through `@microservices-sh/html-renderer`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/html-renderer check:spec`.
5. Run `pnpm --filter @microservices-sh/html-renderer build` after source edits.

Mutation rules:

- Validate slugs before creating documents.
- TTL is seconds: omitted means default expiry, `0` means no expiry.
- Asset paths must be relative and cannot include parent traversal.
- Public auth, KV/R2 storage, and route serving belong in app adapters.
