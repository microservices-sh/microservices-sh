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
- PDF rasterization for OCR (poppler `pdftoppm`)
- local OCR command execution
- local Gemma/Ollama adapter calls
- audited operator corrections (field edit, approve, reject)
- sync client transport

The Svelte UI calls Rust through Tauri commands and renders state. Current
intake commands are `select_import_files`, `select_import_folder`, `import_document_paths`,
`queue_documents`, `runtime_settings`, `save_runtime_settings`,
`install_gemma_model`, `extract_document`, `document_draft`,
`update_draft_field`, `approve_job`, `reject_job`, and `sync_status`.

## Local Extraction Boundary

The desktop template reuses the `document-extraction` module shape for local
drafts but does not make the desktop app the canonical document extraction
module. The native app may:

- rasterize PDF pages to images with poppler `pdftoppm` so they can be OCR'd;
- run Tesseract for scanned image and rasterized PDF OCR when installed locally;
- call a configured local Ollama Gemma model when it is already installed,
  either to normalize OCR text or to extract directly from scanned page images;
- save selected OCR language and Gemma model in the local app settings table;
- install a selected Gemma model only after the user clicks the install action;
- persist draft JSON in local SQLite for human review;
- let an operator edit extracted field values, then approve or reject a draft;
- record every field edit and approve/reject decision in a local `draft_edits`
  audit table so only approved drafts become sync-eligible;
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
