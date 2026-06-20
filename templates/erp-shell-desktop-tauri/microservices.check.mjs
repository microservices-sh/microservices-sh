export default function check({ assertFileIncludesAll }) {
  assertFileIncludesAll(
    "src-tauri/tauri.conf.json",
    ["erp-shell-desktop", "macOS", "nsis"],
    "Desktop template declares macOS and Windows bundle metadata."
  );
  assertFileIncludesAll(
    "src/App.svelte",
    [
      "AppShell",
      "CustomSelect",
      "PageHeader",
      "MetricStrip",
      "ResourceTable",
      "Drop or Select Documents",
      "Review Drafts",
      "ERP import",
      "Submit Selected",
      "Runtime settings",
      "Test Selected Model"
    ],
    "Desktop MVP uses the ERP shell chrome and shared UI primitives."
  );
  assertFileIncludesAll(
    "src/lib/ui/index.ts",
    ["AppShell", "CustomSelect", "Logo", "PageHeader", "ResourceTable"],
    "Desktop MVP exports the same app shell and logo primitives as ERP Shell."
  );
  assertFileIncludesAll(
    "src-tauri/capabilities/default.json",
    ["core:default", "dialog:default"],
    "Desktop MVP grants the dialog permission needed for native file and folder pickers."
  );
  assertFileIncludesAll(
    "index.html",
    ["IBM+Plex+Mono", "IBM+Plex+Sans", "document.documentElement.dataset.theme"],
    "Desktop MVP loads the same ERP Shell fonts and theme bootstrap."
  );
  assertFileIncludesAll(
    "src/app.css",
    ['@import "./lib/ui/tokens.css"', "var(--color-panel-subtle)", "var(--color-line)"],
    "Desktop MVP uses the shared UI token stylesheet instead of a standalone palette."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    [
      "select_import_files",
      "import_document_paths",
      "draft_queue_dedupes_by_file_hash",
      "extract_document",
      "draft_json",
      "desktop_import_request",
      "mark_job_imported"
    ],
    "Desktop intake supports dropped files/folders, queue dedupe, and persisted extraction drafts."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    ["tesseract", "MICROSERVICES_DESKTOP_GEMMA_MODEL", "ollama", "normalize_with_gemma", "normalize_with_gemma_images", "install_gemma_model", "test_gemma_model"],
    "Desktop extraction uses optional local OCR and an explicit local Gemma/Ollama adapter boundary."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    ["app_settings", "runtime_settings", "save_runtime_settings", "probe_gemma_model", "runtime_settings_persist_selected_model_and_ocr_language"],
    "Desktop runtime settings persist local OCR/model choices and can test the selected local LLM."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    [
      "rasterize_pdf",
      "pdftoppm",
      "update_draft_field",
      "approve_job",
      "reject_job",
      "draft_edits",
      "update_field_records_edit_and_clears_review",
      "reject_excludes_job_from_pending"
    ],
    "Desktop intake rasterizes PDFs for OCR and supports audited field correction, approve, and reject."
  );
  assertFileIncludesAll(
    "src/App.svelte",
    ["saveField", "approveDraft", "rejectDraft", "submitApprovedToErp", "field-input"],
    "Desktop review UI allows editing extracted fields, approving or rejecting drafts, and submitting approved drafts."
  );
  assertFileIncludesAll(
    "docs/api-boundary.md",
    [
      "extract_document",
      "document_draft",
      "install_gemma_model",
      "test_gemma_model",
      "silently download model weights",
      "update_draft_field",
      "approve_job",
      "reject_job",
      "desktop_import_request",
      "mark_job_imported",
      "remote ERP database is canonical"
    ],
    "Desktop API boundary documents local extraction, correction, approval, and remote ERP import boundaries."
  );
}
