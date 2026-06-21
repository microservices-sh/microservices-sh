# Estimate Quote Module Agent Guide

Use this module through `@microservices-sh/estimate-quote`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/estimate-quote check:spec`.
5. Run `pnpm --filter @microservices-sh/estimate-quote build` after source edits.

Mutation rules:

- Only draft quotes can be edited.
- Only draft quotes can be sent.
- Only sent or viewed quotes can be accepted or declined.
- Only accepted quotes can be converted.
- Conversion requires the caller to provide the invoice id created by an invoice module or app adapter.
