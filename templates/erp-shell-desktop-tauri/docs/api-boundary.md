# API Boundary

## Desktop Boundary

The desktop app may read local folders, maintain local draft extraction state,
and call a configured ERP Shell backend. It must not become the canonical store
for business records in the MVP.

## Rust Boundary

Rust commands own native capabilities:

- local file/folder access
- model/runtime process supervision
- local SQLite draft queue
- local OCR command execution
- local Gemma/Ollama adapter calls
- sync client transport

The Svelte UI calls Rust through Tauri commands and renders state. Current
intake commands are `select_import_folder`, `import_document_paths`,
`queue_documents`, `extract_document`, `document_draft`, and `sync_status`.

## Local Extraction Boundary

The desktop template reuses the `document-extraction` module shape for local
drafts but does not make the desktop app the canonical document extraction
module. The native app may:

- run Tesseract for scanned image OCR when it is installed locally;
- call a configured local Ollama Gemma model when it is already installed;
- persist draft JSON in local SQLite for human review;
- keep source file paths, hashes, confidence, warnings, and raw OCR text.

The native app must not:

- silently download model weights;
- bundle large LLM weights in the default installer;
- call remote AI providers from the desktop template without an explicit
  governed adapter;
- sync unreviewed extraction output into production ERP records.

## Backend Boundary

The deployed ERP Shell app owns:

- auth and organization membership
- customer, invoice, support, and file records
- audit log
- production object storage

Desktop sync must create draft or reviewed records through explicit backend API
calls once those endpoints exist.
