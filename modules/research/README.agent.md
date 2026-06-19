# Research Module Agent Guide

Use this module through `@microservices-sh/research`.

Safe first actions:
1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Invariants you must preserve:
- Cite-or-refuse: never answer without grounded, retrieved sources.
- Owner-scoped retrieval and actor-derived ownerId.
- Fail-closed authz; audit every ingest and brief.

Do not wire real embedding/LLM providers, secrets, migrations, or production deploy
without approval (`approval.requiresApprovalFor` includes `ai-provider-calls`).
