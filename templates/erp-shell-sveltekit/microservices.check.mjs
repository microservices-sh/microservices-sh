export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/signup/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "createOrganization"],
    "Company setup route stays a thin adapter over org-team-rbac createOrganization."
  );
  assertFileIncludesAll(
    "src/routes/app/settings/team/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "inviteMember", "updateMemberRole"],
    "Team route (Settings hub) uses org-team-rbac invite/role use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/team/accept/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "acceptInvitation"],
    "Invitation accept route uses org-team-rbac acceptInvitation."
  );
  assertFileIncludesAll(
    "src/routes/app/customers/+page.server.ts",
    ["@microservices-sh/customer", "listCustomers"],
    "Customers route uses the customer module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/+page.server.ts",
    ["@microservices-sh/invoice", "listInvoices"],
    "Invoices route uses the invoice module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/recurring/+page.server.ts",
    ["listRecurringInvoiceTemplatesScoped", "updateRecurringInvoiceTemplateStatusScoped", "recurringInvoiceStore"],
    "Recurring invoices route uses scoped invoice module recurring use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/recurring/new/+page.server.ts",
    ["createRecurringInvoiceTemplateScoped", "recurringInvoiceStore"],
    "Recurring invoice creation route stays a thin adapter over the invoice module."
  );
  assertFileIncludesAll(
    "migrations/0004_invoice.sql",
    ["CREATE TABLE IF NOT EXISTS invoice_recurring_templates", "idx_invoices_recurring_occurrence"],
    "Template keeps recurring invoice tables and occurrence dedupe index aligned with the invoice module."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1RecurringInvoiceStore", "createMemoryRecurringInvoiceStore", "recurringInvoiceStore"],
    "Template wires the invoice recurring template store through the server store resolver."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.recurringInvoiceStore = stores.recurringInvoiceStore",
    "Request locals expose the recurring invoice store to route adapters."
  );
  assertFileIncludesAll(
    "src/lib/server/stores.ts",
    ["createD1JobRunStore", "createMemoryJobRunStore", "jobRunStore"],
    "Template wires job run storage for due job execution records."
  );
  assertFileIncludes(
    "src/hooks.server.ts",
    "event.locals.jobRunStore = stores.jobRunStore",
    "Request locals expose the job run store to route adapters."
  );
  assertFileIncludesAll(
    "src/routes/app/jobs/+page.server.ts",
    ["runDueJobs", "createRecurringInvoiceJobHandlers", "jobRunStore"],
    "Jobs route can run due jobs through the registered recurring invoice handler."
  );
  assertFileIncludes(
    "src/lib/server/recurring-invoice-jobs.ts",
    "invoice.recurring.generate_due",
    "Template registers the recurring invoice generate-due job handler."
  );
  assertFileIncludesAll(
    "src/routes/app/files/+page.server.ts",
    ["@microservices-sh/file-media", "listFiles"],
    "Files route uses the file-media module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/+layout.server.ts",
    ["@microservices-sh/org-team-rbac", "resolvePermissions", "buildNav"],
    "The /app layer gates membership through org-team-rbac and builds the lock-driven nav."
  );
  assertFileIncludesAll(
    "src/lib/server/erp-nav.ts",
    ["enabledModuleIds", "buildNav"],
    "Sidebar nav is derived from the enabled module set."
  );
  assertFileIncludesAll(
    "src/lib/server/modules.ts",
    ["microservices.lock.json", "ENABLED_MODULES", "requireModule"],
    "Module enablement reads the lockfile + ENABLED_MODULES and guards routes with requireModule."
  );
  assertFileIncludesAll(
    "src/routes/admin/[resource]/+page.server.ts",
    ["@microservices-sh/admin-shell", "listRecords"],
    "Super-admin route uses admin-shell listRecords over the table gateway."
  );
  assertFileIncludes(
    "migrations/0002_org_team_rbac.sql",
    "idx_memberships_org_user",
    "Template keeps the org-team-rbac per-(org,user) membership uniqueness index."
  );
  assertFileIncludesAll(
    "migrations/0025_accounts_receivable.sql",
    ["CREATE TABLE IF NOT EXISTS ar_invoice_snapshots", "unapplied_cents INTEGER NOT NULL DEFAULT 0"],
    "Template keeps Accounts Receivable D1 schema aligned with invoice snapshots and unapplied balances."
  );
  assertFileIncludesAll(
    "scripts/smoke-http.mjs",
    ["route:/", "route:/app:auth-redirect"],
    "HTTP smoke script verifies the public pages and the /app auth gate."
  );
  assertFileIncludesAll(
    "src/routes/api/desktop/import/+server.ts",
    [
      "DESKTOP_IMPORT_TOKEN",
      "desktop.draft.import",
      "enqueueJob",
      "recordEvent",
      "canonicalStore: \"remote-d1\""
    ],
    "Desktop import API authenticates approved desktop drafts, queues a module job, and records an audit event."
  );
  assertFileIncludesAll(
    "wrangler.jsonc",
    ["DB", "MEDIA_BUCKET", "RATE_LIMIT_KV", "IMAGE_BUCKET", "JOB_QUEUE", "DESKTOP_IMPORT_ALLOWED_ORIGIN"],
    "Cloudflare deployment config declares canonical D1 plus R2/KV/Queue bindings used by the ERP Worker."
  );
  assert(
    !exists("src/lib/server/modules/org-team-rbac/index.ts"),
    "Template does not own org-team-rbac internals.",
    "policy:no-local-rbac-module"
  );
  assert(
    !exists("src/lib/server/modules/customer/index.ts"),
    "Template does not own customer module internals.",
    "policy:no-local-customer-module"
  );
}
