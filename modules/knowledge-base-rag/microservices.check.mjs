export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS knowledge_articles",
    "Knowledge Base RAG module migration owns its article table."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS knowledge_sources",
    "Knowledge Base RAG module migration owns its source table."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS knowledge_attachments",
    "Knowledge Base RAG module migration owns its attachment table."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS knowledge_web_scan_jobs",
    "Knowledge Base RAG module migration owns its web scan job table."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS knowledge_feeds",
    "Knowledge Base RAG module migration owns its feed table."
  );
}
