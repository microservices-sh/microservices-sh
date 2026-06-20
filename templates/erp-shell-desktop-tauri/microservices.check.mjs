export default function check({ assertFileIncludesAll }) {
  assertFileIncludesAll(
    "src-tauri/tauri.conf.json",
    ["erp-shell-desktop", "macOS", "nsis"],
    "Desktop template declares macOS and Windows bundle metadata."
  );
  assertFileIncludesAll(
    "src/App.svelte",
    ["AppShell", "PageHeader", "MetricStrip", "ResourceTable", "Drop or Select Documents", "Runtime settings"],
    "Desktop MVP uses the ERP shell chrome and shared UI primitives."
  );
  assertFileIncludesAll(
    "src/lib/ui/index.ts",
    ["AppShell", "Logo", "PageHeader", "ResourceTable"],
    "Desktop MVP exports the same app shell and logo primitives as ERP Shell."
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
    ["import_document_paths", "draft_queue_dedupes_by_file_hash", "extract_document", "draft_json"],
    "Desktop intake supports dropped files/folders, queue dedupe, and persisted extraction drafts."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    ["tesseract", "MICROSERVICES_DESKTOP_GEMMA_MODEL", "ollama", "normalize_with_gemma", "install_gemma_model"],
    "Desktop extraction uses local OCR and an explicit local Gemma/Ollama adapter boundary."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    ["app_settings", "runtime_settings", "save_runtime_settings", "runtime_settings_persist_selected_model_and_ocr_language"],
    "Desktop runtime settings persist local OCR/model choices."
  );
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["extract_document", "document_draft", "install_gemma_model", "silently download model weights"],
    "Desktop API boundary documents local extraction commands and the no-silent-download rule."
  );
}
