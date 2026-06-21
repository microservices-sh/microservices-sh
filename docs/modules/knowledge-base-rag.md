# Knowledge Base RAG

Status: draft
Module ID: `knowledge-base-rag`
Mount: `/knowledge`

## Summary
Tenant-scoped knowledge base with curated articles, source records, attachment references, search, and cite-or-refuse grounded answers for support workflows.

This module is the Helpgrid-derived support knowledge slice. It should be shared by support inboxes, operator assistants, customer success workflows, and future public help-center templates instead of embedding per-template knowledge tables.

## Dependencies
- none

Optional integrations:

- auth
- org-team-rbac
- audit-log
- file-media
- support-ticket
- ai-gateway
- jobs-workflows

## Permissions
- knowledge-base-rag.read
- knowledge-base-rag.write
- knowledge-base-rag.admin
- knowledge-base-rag.extend
- knowledge-base-rag.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

Tables:

- knowledge_articles
- knowledge_sources
- knowledge_attachments
- knowledge_web_scan_jobs
- knowledge_feeds
- domain_events

## RPC
- `createArticle` with `knowledge-base-rag.write`
- `getArticle` with `knowledge-base-rag.read`
- `listArticles` with `knowledge-base-rag.read`
- `updateArticle` with `knowledge-base-rag.write`
- `recordSource` with `knowledge-base-rag.write`
- `listSources` with `knowledge-base-rag.read`
- `attachArticleFile` with `knowledge-base-rag.write`
- `listAttachments` with `knowledge-base-rag.read`
- `createWebScanJob` with `knowledge-base-rag.write`
- `listWebScanJobs` with `knowledge-base-rag.read`
- `updateWebScanJob` with `knowledge-base-rag.write`
- `createKnowledgeFeed` with `knowledge-base-rag.write`
- `listKnowledgeFeeds` with `knowledge-base-rag.read`
- `updateKnowledgeFeed` with `knowledge-base-rag.write`
- `searchKnowledge` with `knowledge-base-rag.read`
- `answerQuestion` with `knowledge-base-rag.read`
- `draftSupportReply` with `knowledge-base-rag.write`

## Hooks
- beforeArticleCreate
- beforeArticleUpdate
- afterAttachmentAdded
- afterGroundedAnswerDrafted

## Events
- knowledge-base-rag.article_created
- knowledge-base-rag.article_updated
- knowledge-base-rag.source_recorded
- knowledge-base-rag.attachment_added
- knowledge-base-rag.web_scan_job_created
- knowledge-base-rag.web_scan_job_updated
- knowledge-base-rag.feed_created
- knowledge-base-rag.feed_updated

## Invariants
- Every article, source, attachment, search, and answer is tenant-scoped.
- Operator-facing scoped use-cases derive `tenantId` from `AuthContext`, never caller input.
- Search returns active articles only.
- Scan jobs and feeds only store sync metadata; actual crawling and external sync execution must live behind approval-gated workers/adapters.
- Vector retrieval must revalidate article tenant, project, and status after Vectorize matches.
- `answerQuestion` and `draftSupportReply` return `422` unless the answer cites retrieved articles.
- Support replies are saved as drafts only; delivery belongs to support/channel modules.
- Files are referenced through attachment metadata and `storageKey`; raw file storage belongs to `file-media`.

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII field changes
- AI-provider calls
- external crawls or sync jobs
- production deploy behavior

## Agent Rules
- Start read-only with `listArticles`, `getArticle`, or `searchKnowledge`.
- Use `answerQuestion` for support assistance and preserve citations.
- Use `draftSupportReply` only when a cited draft is acceptable.
- If no grounded citation exists, report that the knowledge base cannot answer.
- Do not send customer messages from this module.

## Source Reference
Generated registries resolve this module through:

```text
modules/knowledge-base-rag/v0.1.0
```

## Update Notes
Keep this module framework-neutral. Templates own routes, UI, app-shell navigation, and support inbox composition; this module owns knowledge behavior, schemas, ports, adapters, hooks, events, permissions, resources, and migrations.
