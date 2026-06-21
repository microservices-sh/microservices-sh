export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_support_ticket.sql",
    "CREATE TABLE IF NOT EXISTS support_tickets",
    "Support-ticket module migration owns the support_tickets table."
  );
  assertFileIncludes(
    "migrations/0002_ticket_thread_share_tokens.sql",
    "ALTER TABLE support_tickets ADD COLUMN ticket_number",
    "Support-ticket module upgrade adds ticket numbers without rewriting 0001."
  );
  assertFileIncludes(
    "migrations/0002_ticket_thread_share_tokens.sql",
    "CREATE TABLE IF NOT EXISTS support_ticket_sequences",
    "Support-ticket module migration owns ticket numbering sequences."
  );
  assertFileIncludes(
    "migrations/0002_ticket_thread_share_tokens.sql",
    "CREATE TABLE IF NOT EXISTS support_ticket_comments",
    "Support-ticket module migration owns ticket comments."
  );
  assertFileIncludes(
    "migrations/0002_ticket_thread_share_tokens.sql",
    "CREATE TABLE IF NOT EXISTS support_ticket_attachments",
    "Support-ticket module migration owns attachment metadata."
  );
  assertFileIncludes(
    "migrations/0002_ticket_thread_share_tokens.sql",
    "CREATE TABLE IF NOT EXISTS support_ticket_share_tokens",
    "Support-ticket module migration owns public share-token records."
  );
  assertFileIncludes(
    "src/use-cases/update-ticket.ts",
    "support-ticket.status_changed",
    "Status transitions emit a dedicated support-ticket.status_changed event."
  );
  assertFileIncludes(
    "src/use-cases/resolve-ticket-share-token.ts",
    "SHARE_TOKEN_EXPIRED",
    "Public share-token resolution handles expiry."
  );
  assertFileIncludes(
    "src/use-cases/create-ticket-share-token.ts",
    "crypto.getRandomValues",
    "Public share-token generation uses cryptographic randomness."
  );
}
