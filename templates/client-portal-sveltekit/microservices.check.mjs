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
    ["@microservices-sh/file-media", "createUploadTicket", "completeUpload", "ownerId: user.customerId"],
    "Files route uses the file-media module's two-step upload flow scoped by customer ownerId."
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
