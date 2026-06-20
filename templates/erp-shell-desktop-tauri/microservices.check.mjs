export default function check({ assertFileIncludesAll }) {
  assertFileIncludesAll(
    "src-tauri/tauri.conf.json",
    ["erp-shell-desktop", "macOS", "nsis"],
    "Desktop template declares macOS and Windows bundle metadata."
  );
  assertFileIncludesAll(
    "src/App.svelte",
    ["PageHeader", "MetricStrip", "ResourceTable", "Drop or Select Documents"],
    "Desktop MVP uses shared UI primitives for import, runtime, and sync surfaces."
  );
  assertFileIncludesAll(
    "src/app.css",
    ['@import "./lib/ui/tokens.css"', "var(--color-panel)", "var(--color-line)"],
    "Desktop MVP uses the shared UI token stylesheet instead of a standalone palette."
  );
  assertFileIncludesAll(
    "src-tauri/src/main.rs",
    ["import_document_paths", "draft_queue_dedupes_by_file_hash"],
    "Desktop intake supports dropped files/folders and tests queue dedupe."
  );
}
