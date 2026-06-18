# Agent Guide: Operator Work Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral.
2. Do not import SvelteKit, Hono, provider SDKs, or route code from `src/use-cases`.
3. Put task, focus block, and review persistence behind `OperatorWorkStore`.
4. Every write path must accept `actorId` and `source` so AI/user edits remain auditable.
5. D1 behavior belongs in `src/adapters/d1-operator-work-store.ts`; local/demo behavior belongs in `src/adapters/memory-operator-work-store.ts`.
6. Treat AI provider calls, calendar write-back, email/customer communications, external publishing, migrations, and production deploy behavior as approval-gated.
7. Run `pnpm --filter @microservices-sh/operator-work build` and consuming template builds after edits.
