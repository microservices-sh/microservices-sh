# Knowledge Base RAG Module

Status: `draft`

Tenant-scoped knowledge base with articles, attachments, sources, ingestion jobs, semantic search, and cite-or-refuse grounded answers for support.

## Public Surface

```ts
import { knowledgeBaseRagModule } from "@microservices-sh/knowledge-base-rag";
```

Templates can bind all use-cases to shared deps through:

- `createKnowledgeBaseRagService(deps)` for internal jobs.
- `createKnowledgeBaseRagScopedService(ctx, deps)` for operator/request paths.

Core use-cases:

- `createArticle`, `updateArticle`, `listArticles`, `getArticle`
- `recordSource`, `listSources`, `attachArticleFile`, `listAttachments`
- `createWebScanJob`, `updateWebScanJob`, `listWebScanJobs`
- `createKnowledgeFeed`, `updateKnowledgeFeed`, `listKnowledgeFeeds`
- `searchKnowledge`, `answerQuestion`
- `draftSupportReply`

`answerQuestion` and `draftSupportReply` are cite-or-refuse: if the synthesizer does not cite retrieved active articles, the use-case returns `422` and no draft is saved. Support replies are draft-only; sending a customer message belongs to `support-ticket` or a channel module.

## Ownership Boundary

The module owns knowledge articles, source records, attachment references, scan job metadata, feed sync metadata, tenant-scoped search, grounded-answer validation, schemas, hooks, events, permissions, resources, and migrations for `knowledge-base-rag`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.

Provider integrations stay behind ports:

- `KnowledgeSearchIndex` for Vectorize, embeddings, or external search.
- `AnswerSynthesizer` for AI Gateway or model-specific answer generation.
- `SupportReplySink` for saving a draft into support tooling.

Adapter helpers:

- `createExtractiveSynthesizer()` for deterministic local/test answers.
- `createGatewayAnswerSynthesizer(complete)` for a governed `ai-gateway` completion closure.
- `createGatewayEmbeddingFn(embed)` for a governed `ai-gateway` embedding closure.
- `createEmbeddingKnowledgeSearchIndex({ embed, vectorStore, store })` for provider-neutral vector retrieval.
- `createVectorizeStore(env.VECTORIZE)` for Cloudflare Vectorize-backed retrieval.
