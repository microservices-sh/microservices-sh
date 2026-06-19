# Research Module

Research pillar for microservices.sh. Ingests company knowledge, retrieves by
semantic search, and produces **cited research briefs** — refusing to answer
when nothing grounds the question (cite-or-refuse).

## Invariants
- **Cite-or-refuse:** no retrieved passages → 422; a synthesis that cites a
  source it was not given → 422. Never answers ungrounded.
- **Owner-scoped retrieval:** an actor only retrieves their own sources (or with `research.admin`).
- **Actor-derived identity:** `ownerId` comes from the authenticated actor, never the client.
- **Governed:** fail-closed authz (401/403), audit on ingest + brief creation.

## Use cases
- `ingestSource(input, deps)` — chunk + embed + store a source.
- `research(input, deps)` — embed question → retrieve → cited synthesis → brief.
- `getBrief({ briefId }, deps)` / `listSources(deps)` — owner-scoped reads.

Ports injected: `EmbeddingPort` (Workers AI), `VectorStore` (Vectorize), `Synthesizer` (LLM),
`ResearchStore` (D1), `AuditSink` (audit-log).

Emits `research.brief_created`, consumed by `@microservices-sh/decision` to ground decisions.
