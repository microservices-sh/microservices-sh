# Document Extraction Module

Status: `draft` (v0.1.0) · Class: `core` · Risk: `medium`

Local-first document extraction for business workflows. The module owns the
review queue: source file reference, target schema, extracted draft, confidence,
human approval/rejection, and approved output.

It does **not** own model installation. Browser OCR/local LLM, `ai-gateway`, and
sidecar runtimes are adapters behind the same extraction draft shape.

## Runtime modes

- `local-only` - browser OCR/local model only; no provider calls.
- `gateway-only` - all model calls go through `ai-gateway`.
- `hybrid` - local first, governed gateway fallback.
- `sidecar` - local machine/per-client runtime for agency migration or private deployments.

## Gemma 4

Gemma support is through adapters, not hard-coded into the module:

- `@microservices-sh/ai-gateway/adapters/gemma-ollama` for local Ollama sidecars.
- `@microservices-sh/ai-gateway/adapters/gemma-openai-compatible` for vLLM, LM Studio, LiteLLM, Cloud Run, or Vertex-style OpenAI-compatible endpoints.
- `createGemmaExtractionNormalizer` converts OCR/layout text into schema-normalized extraction drafts.

## Public Surface

```ts
import {
  createDocumentExtractionHandler,
  createExtractionJob,
  submitExtractionDraft,
  reviewExtraction,
  createMemoryDocumentExtractionStore,
  createGemmaExtractionNormalizer
} from "@microservices-sh/document-extraction";
```

## HTTP Boundary

`createDocumentExtractionHandler({ store })` is a Fetch-standard route adapter
for local apps and generated templates. Mount it at `/documents` from SvelteKit,
Hono, or a Worker without importing those frameworks into the module.

Routes:

- `GET /documents?tenantId=...` - list jobs.
- `POST /documents` - create a job.
- `GET /documents/:jobId?tenantId=...` - fetch a job.
- `POST /documents/:jobId/draft` - submit an OCR/LLM draft.
- `POST /documents/:jobId/review` - approve or reject the draft.

## Ownership Boundary

This module owns extraction job state, schemas, hooks, events, permissions,
resources, and migrations.

Templates own route adapters and UI. `file-media` owns uploaded bytes. `ai-gateway`
owns governed provider calls, BYOK, budget, audit, and metering.
