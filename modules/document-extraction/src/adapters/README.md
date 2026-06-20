# Document Extraction Adapters

Adapters:

- `memory-document-extraction-store.ts` supports unit tests, previews, and generated demos.
- `d1-document-extraction-store.ts` persists extraction jobs in the `document_extraction_jobs` D1 table.
- `gemma-normalizer.ts` converts OCR/layout text into schema-normalized drafts through an injected completion client.

Keep provider side effects behind explicit function calls and approval-gated UI states.
