export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS recurring_document_templates",
    "Recurring Documents module migration owns recurring document templates."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS recurring_document_lines",
    "Recurring Documents module migration owns recurring document lines."
  );
}
