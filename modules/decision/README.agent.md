# Decision Module Agent Guide

Use this module through `@microservices-sh/decision`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Invariants you must preserve:

- Cite-or-refuse: never let `draftDecisionBrief` accept a recommendation without a valid provided source.
- Human-owned: `draftDecisionBrief` always yields `status: "draft"`; only `recordDecision` decides.
- Append-only: never mutate or delete `decision_logs` rows.

Do not add real LLM provider calls, secrets, migrations, or production deploy behavior without approval
(`approval.requiresApprovalFor` includes `ai-provider-calls`).
