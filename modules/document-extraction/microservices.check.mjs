export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS document_extraction_jobs",
    "Document Extraction module migration owns its review queue table."
  );
  assertFileIncludes(
    "src/adapters/gemma-normalizer.ts",
    "You convert OCR text from scanned business documents into strict JSON.",
    "Document Extraction module includes the Gemma normalization adapter."
  );
}
