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
- sync client transport

The Svelte UI calls Rust through Tauri commands and renders state. Current
intake commands are `select_import_folder`, `import_document_paths`,
`queue_documents`, and `sync_status`.

## Backend Boundary

The deployed ERP Shell app owns:

- auth and organization membership
- customer, invoice, support, and file records
- audit log
- production object storage

Desktop sync must create draft or reviewed records through explicit backend API
calls once those endpoints exist.
