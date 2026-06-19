# AI Gateway Module Agent Guide

Use this module through `@microservices-sh/ai-gateway`.

Safe first actions:
1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Invariants you must preserve:
- Fail-closed authz (`ai.invoke`); never call a provider for an unauthorized actor.
- Budget check runs BEFORE the provider call (no cost when exhausted).
- ownerId/tenant derived from the actor; meter every call.
- Keep prompts and cite-or-refuse OUT of the gateway — they belong to the caller.

Real provider adapters (Workers AI, Anthropic, OpenAI, Gemini) are approval-gated
(`ai-provider-calls`) and not built here yet (Phase 2).
