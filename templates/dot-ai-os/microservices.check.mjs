export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/signup/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "createOrganization"],
    "Workspace setup route stays a thin adapter over org-team-rbac createOrganization."
  );
  assertFileIncludesAll(
    "src/routes/app/team/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "inviteMember", "updateMemberRole"],
    "Team route uses org-team-rbac invite/role use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/team/accept/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "acceptInvitation"],
    "Invitation accept route uses org-team-rbac acceptInvitation."
  );
  assertFileIncludesAll(
    "src/routes/app/customers/+page.server.ts",
    ["@microservices-sh/customer", "listCustomers"],
    "Contacts route uses the customer module list use case."
  );
  assertFileIncludesAll(
    "src/routes/app/invoices/+page.server.ts",
    ["@microservices-sh/invoice", "listInvoices"],
    "Work packets route uses the invoice module list use case."
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
    ["microservices.lock.json", "Tasks", "Calendar", "Content pipeline", "AI team", "buildNav"],
    "DOT AI OS sidebar nav is derived from the installed module set and includes upstream-informed workbench surfaces."
  );
  assertFileIncludesAll(
    "src/routes/app/+page.svelte",
    ["Clear Workbench", "Daily unlock", "Module-backed surfaces", "$lib/os-data"],
    "DOT AI OS workbench route renders the upstream-informed operator dashboard."
  );
  assertFileIncludesAll(
    "src/routes/app/focus/+page.svelte",
    ["calendar-google", "jobs-workflows"],
    "Focus plan page documents optional calendar and job module slots."
  );
  assertFileIncludesAll(
    "src/routes/app/tasks/+page.svelte",
    ["Task board", "AI intake", "$lib/os-data"],
    "Tasks page renders the starter task board contract."
  );
  assertFileIncludesAll(
    "src/routes/app/calendar/+page.svelte",
    ["dashboard.ics", "calendar-google", "Sync Google"],
    "Calendar page preserves the Google Calendar feed/sync workflow as an optional slot."
  );
  assertFileIncludesAll(
    "src/routes/app/content/+page.svelte",
    ["Weekly inspiration radar", "Generate brief", "$lib/os-data"],
    "Content pipeline page maps knowledge into output workflow."
  );
  assertFileIncludesAll(
    "src/routes/app/ai-team/+page.svelte",
    ["AI team", "Routing rule", "$lib/os-data"],
    "AI team page renders visible digital-worker routing roles."
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
    "scripts/smoke-http.mjs",
    ["route:/", "route:/app:auth-redirect"],
    "HTTP smoke script verifies the public pages and the /app auth gate."
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
