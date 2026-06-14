# Agent Guide: Customer Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral.
2. Do not import SvelteKit, Hono, or app route code from `src/use-cases`.
3. Put persistence behind `CustomerRepository`.
4. Put Cloudflare D1 behavior in `src/adapters/d1-customer-repository.ts`.
5. Treat migrations, PII fields, external syncs, and production deploy behavior as approval-gated.
6. Prefer config/hooks before overlays or forks.
7. Run `pnpm --filter @microservices-sh/customer build` and consuming template builds after edits.
