# ERP Shell Desktop Roadmap

Status: M1 local intake foundation validated on Linux native checks; M2 local
image OCR slice started.

This template is the desktop companion for generated ERP Shell apps. It is not
the canonical ERP database. Its job is to make local document intake,
extraction review, optional local AI runtime control, and approved ERP import usable
on macOS and Windows.

## Product Modes

| Mode | Purpose | State |
|---|---|---|
| `browser-preview` | Review the UI without launching Tauri. | Built |
| `desktop-connected` | Read local files, keep draft state locally, submit approved drafts to the ERP backend. | In progress |
| `desktop-local-first` | Queue and review extraction while offline; submit after approval. | Later |
| `offline-extraction` | Run OCR and local LLM extraction without cloud dependency. | Started for scanned images |

## Milestones

### M0 — Desktop Shell MVP

State: built.

Scope:

- Svelte/Vite UI.
- Tauri/Rust shell.
- Browser preview fallback.
- Stubbed import queue, runtime status, and ERP import status.
- Linux Docker native check for WebKitGTK/Tauri compilation.

Acceptance:

- `pnpm build` passes.
- `pnpm microservices check --json` passes.
- Docker Linux check passes with `docker run --rm -v "$PWD:/host:ro" msh-erp-desktop-linux-check`.

### M1 — Real Local Intake

State: in progress.

Built:

- Native file and folder pickers.
- Drag/drop file intake.
- Local SQLite draft queue.
- File hashing and duplicate detection.
- Import discovery and dedupe tests.
- PDF page count via poppler `pdfinfo` at import time.

Remaining scope:

- Watched folder configuration.

Acceptance:

- Importing a folder creates local draft jobs without touching the ERP backend.
- Re-importing the same file does not create duplicates.
- Draft state survives app restart.
- The UI clearly separates local drafts from remote-imported records.

### M2 — OCR and Extraction Review

State: in progress.

Built:

- Local scanned image OCR adapter through installed Tesseract.
- PDF rasterization (poppler `pdftoppm`) so multi-page PDFs are OCR'd page by
  page, not just single images.
- SQLite `draft_json` persistence for document-extraction-shaped drafts.
- Optional Gemma 4 normalization through a configured local Ollama model.
- Gemma vision fallback for scanned image extraction when Tesseract is not
  installed and the selected Ollama model is ready.
- Settings panel for selected Gemma model, OCR language, local runtime checks,
  and explicit Ollama model install.
- Deterministic fallback draft when OCR/model runtime is missing.
- Queue action and draft review panel in the desktop UI.
- Human review and correction: inline field editing, plus approve/reject, with
  every edit and decision recorded in a local `draft_edits` audit table. Only
  approved drafts can be submitted to the ERP Worker; rejected drafts leave the
  pending queue.

Remaining scope:

- Line-item table extraction (`ExtractedTable` is modeled but not yet emitted).
- Deterministic field validators (total = sum of line items, date/currency
  parsing) to replace fabricated heuristic confidence as the review signal.
- Source-region bounding boxes and a document-image preview beside each field.

Acceptance:

- A scanned invoice can become a reviewed draft with editable fields. ✅
- The user can approve, reject, or re-run extraction for a job. ✅
- Each extracted field has source evidence and confidence. (text source only;
  bounding boxes pending)
- Low-confidence fields are highlighted before import. ✅ (needs validator-backed
  confidence)

### M3 — Local AI Runtime Manager

Scope:

- Optional local runtime adapter, not bundled by default.
- Sidecar supervision from Rust.
- Health checks, model status, and download/install state.
- Adapter boundary for Ollama, llama.cpp/GGUF, and future cloud fallback.
- Gemma-family models as one supported option when available in the selected
  local runtime.

Started:

- Runtime status checks for optional Tesseract OCR and the configured Ollama
  Gemma model.
- Local SQLite runtime settings for model/language selection, with env vars as
  defaults for first launch.
- No silent model download or bundled model weights.

Acceptance:

- The app can detect whether a local runtime is installed and running.
- Model install/download is explicit and user-approved.
- Extraction works with a local adapter or a configured remote fallback.
- Failures leave drafts intact and visible for manual review.

### M4 — Governed ERP Import

Scope:

- Import client from desktop drafts to generated ERP Shell backend APIs.
- Authenticated workspace connection.
- Draft-to-record mapping for `document-extraction`, `file-media`, `invoice`,
  `customer`, `support-ticket`, and `jobs-workflows` as each module supports it.
- Audit events for approve/import operations.

Acceptance:

- Only approved drafts import.
- Import failures are retryable and idempotent.
- The backend remains the canonical source for production records.
- Each imported record links back to the local draft and source file metadata.

### M5 — Signed Desktop Distribution

Scope:

- macOS Apple Silicon signed `.dmg`.
- Windows x64 signed NSIS installer.
- Release CI.
- App data migration.
- Crash/log export.
- Optional auto-update channel.

Acceptance:

- Fresh install works on macOS and Windows without developer tooling.
- Upgrade preserves local draft data.
- Release artifacts are reproducible from CI.
- Signing and notarization steps are documented.

## Business Workflows

Start with document-heavy SMB workflows where manual data entry is painful:

- invoice and receipt intake
- client onboarding forms
- repair/service documents
- statements and remittance advice
- support evidence and photos

The first vertical should be chosen by pilot demand, not by model capability.
The desktop app becomes valuable when it shortens a real back-office workflow,
not when it merely proves local OCR.

## Non-Goals

- Do not build a full offline ERP database in the desktop app.
- Do not submit unreviewed extracted data into production records.
- Do not bundle large local LLM weights in the default installer.
- Do not hard-code one model vendor as the product architecture.
- Do not let Svelte call filesystem/model/process capabilities directly; Rust
  remains the native boundary.

## Next Engineering Slice

1. Add image preprocessing before OCR/Gemma vision.
2. Add watched folder configuration and a persisted import source list.
3. Add a real `desktop-connected` configuration shape for backend import URL and
   workspace identity.
4. Add document-extraction import API contracts.
5. Keep Docker Linux checks green while adding macOS/Windows CI packaging.
