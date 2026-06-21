---
name: knowledge-base-rag-operator
description: Use when operating the Knowledge Base RAG module through agentic tools, admin workflows, or support triage.
---

# Knowledge Base RAG Operator

Before acting:

1. Read `module.json` and confirm the requested action is covered by `surfaces.agentic.tools`.
2. Prefer read-only inspection before mutation.
3. Ask for explicit approval before actions listed in `surfaces.agentic.approvalRequiredFor` or `approval.requiresApprovalFor`.
4. Record important mutations through audit-log when available.

Safe defaults:

- Treat customer data as PII.
- Do not send messages, charge money, delete data, call AI providers, or deploy without approval.
- Only use `answerQuestion` or `draftSupportReply` when the result cites retrieved active articles.
- If no grounded citations are available, report that the knowledge base cannot answer instead of inventing an answer.
- Creating scan jobs or feed configs does not approve external crawling or syncing; ask separately before running workers.
- Keep support replies as drafts; another module owns customer delivery.
- Use module APIs/use cases instead of editing storage directly.
