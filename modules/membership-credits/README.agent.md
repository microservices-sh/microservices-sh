# Membership Credits Module Agent Guide

Use this module through `@microservices-sh/membership-credits`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Operational rules:

- Use integer cents for every credit amount.
- Do not mutate balances directly; use credit service operations so the ledger is written.
- Credit balance changes and membership tier changes require explicit approval in agentic flows.
- Subscription/provider ids are references only; payment provider writes belong in payment or billing modules.
- Do not add provider calls, secrets, migrations, or production deploy behavior without approval.
