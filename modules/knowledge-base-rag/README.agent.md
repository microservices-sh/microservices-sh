# Knowledge Base RAG Module Agent Guide

Use this module through `@microservices-sh/knowledge-base-rag`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Operational rules:

- Prefer `searchKnowledge` and `answerQuestion` before mutating articles.
- Treat knowledge content and ticket context as PII.
- Never send a support response from this module; `draftSupportReply` only creates a draft.
- Refuse ungrounded answers. A valid answer must cite retrieved active articles.
- Treat scan jobs and feed configs as metadata only; external crawling/sync execution requires a separate approval-gated worker/adapter.
- Use `createGatewayAnswerSynthesizer` only with an approval-gated, governed ai-gateway `complete` closure.
- Use `createVectorizeStore` only after the app has created matching metadata indexes for `tenantId`, `projectId`, and `status`.
- Do not add provider calls, secrets, migrations, model downloads, or production deploy behavior without approval.
