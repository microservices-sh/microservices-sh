# Agent Guide: Forms & Intake Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `FormStore` and spam verification behind
   `TurnstileVerifier`. Never make real I/O in tests — use `createMemoryFormStore()`
   and `createMemoryTurnstileVerifier()`.
3. Preserve the correctness invariants — they are the reason this module exists:
   - **Conditional visibility**: keep validation in the pure
     `validateSubmission` (`src/validate-submission.ts`). Compute field visibility
     first; a required-but-hidden field must NEVER be reported as missing. Do not
     re-implement validation in route code — the stored schema is the only source.
   - **Idempotent submissions**: keep the `idempotencyKey` dedup via
     `recordSubmissionKey`. Dedup before persisting.
   - **Spam protection**: keep Turnstile behind the `TurnstileVerifier` port.
     NEVER call `fetch` in a use case — the adapter does it (and fails closed).
   - **Attachments are references only**: validate content-type allowlist + size
     cap via `validateAttachment`; never store or inspect bytes here.
   - **Draft-only edits**: a published form's field set is frozen so historical
     submissions stay interpretable. `updateForm` refuses non-draft forms.
   - **Field definitions stay serializable** (plain data) — they round-trip
     through JSON in D1. No functions or class instances in `FormField`.
4. Risk `medium`: migrations, pii-fields, external side effects, and production
   deploy are approval-gated.
5. Run `pnpm --filter @microservices-sh/forms-intake build` and `check:spec` after edits.
