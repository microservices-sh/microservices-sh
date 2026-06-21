export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/portal/invoices/+page.server.ts",
    ["@microservices-sh/invoice", "listInvoices", "customerId", "invoiceStore"],
    "Customer invoices route stays a thin adapter over listInvoices, scoped by customerId."
  );
  assertFileIncludesAll(
    "src/routes/portal/files/+page.server.ts",
    [
      "@microservices-sh/file-media",
      "@microservices-sh/storage-entitlements",
      "createUploadTicketScoped",
      "completeUploadScoped",
      "canStoreBytes",
      "recordFileStored",
      "recordFileDeleted",
      "releaseReservation",
      "ownerId: user.customerId"
    ],
    "Files route uses scoped file-media two-step uploads plus storage-entitlements quota reservation scoped by customer ownerId."
  );
  assertFileIncludesAll(
    "migrations/0003_storage_entitlements.sql",
    ["CREATE TABLE IF NOT EXISTS storage_accounts", "CREATE TABLE IF NOT EXISTS storage_share_links"],
    "Storage entitlements migration creates account and share-link tables."
  );
  assertFileIncludesAll(
    "migrations/0004_file_media.sql",
    ["CREATE TABLE IF NOT EXISTS upload_tickets", "CREATE TABLE IF NOT EXISTS media_files"],
    "File-media migration creates upload ticket and media file tables for D1-backed portal files."
  );
  assertFileIncludesAll(
    "src/routes/api/login/+server.ts",
    ["@microservices-sh/identity", "requestLoginCode", "verifyLoginCode", "@microservices-sh/email", "customerRepository.findCustomerByEmail"],
    "Login route uses identity/email modules and only issues portal codes to staff or known customer emails."
  );
  assertFileIncludesAll(
    "src/routes/admin/customers/+page.server.ts",
    ["@microservices-sh/customer", "listCustomers"],
    "Customer admin route uses @microservices-sh/customer."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "@microservices-sh/audit-log",
    "Template wires the audit-log module for the activity trail."
  );
  assert(
    !exists("src/lib/server/modules/invoice/index.ts"),
    "Template does not own invoice internals.",
    "policy:no-local-invoice-module"
  );
}
