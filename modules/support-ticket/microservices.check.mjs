export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_support_ticket.sql",
    "CREATE TABLE IF NOT EXISTS support_tickets",
    "Support-ticket module migration owns the support_tickets table."
  );
  assertFileIncludes(
    "src/use-cases/update-ticket.ts",
    "support-ticket.status_changed",
    "Status transitions emit a dedicated support-ticket.status_changed event."
  );
}
