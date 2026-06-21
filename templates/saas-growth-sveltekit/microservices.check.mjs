export default function check({ assert, assertFileIncludes, assertFileIncludesAll, exists }) {
  assertFileIncludesAll(
    "docs/api-boundary.md",
    ["Use Case Shape", "Route Adapter Shape"],
    "API boundary docs define route adapter and use case shapes."
  );
  assertFileIncludesAll(
    "src/routes/signup/+page.server.ts",
    ["@microservices-sh/org-team-rbac", "createOrganization", "@microservices-sh/identity", "verifyLoginCode"],
    "Signup route stays a thin adapter over org-team-rbac and identity use cases."
  );
  assertFileIncludesAll(
    "src/routes/api/login/+server.ts",
    ["@microservices-sh/identity", "requestLoginCode", "verifyLoginCode", "@microservices-sh/email"],
    "Login route uses identity login-code use cases and email delivery."
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
    "src/routes/app/billing/+page.server.ts",
    ["@microservices-sh/billing-subscriptions", "listPlans", "startSubscription", "changePlan"],
    "Billing route uses billing-subscriptions plan/subscription use cases."
  );
  assertFileIncludesAll(
    "src/routes/app/+layout.server.ts",
    ["@microservices-sh/org-team-rbac", "resolvePermissions"],
    "The /app layer gates membership through org-team-rbac resolvePermissions."
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
    ["route:/app:auth-redirect", "Ship a multi-tenant SaaS"],
    "HTTP smoke script verifies the public pages and the /app auth gate."
  );
  assert(
    !exists("src/lib/server/modules/org-team-rbac/index.ts"),
    "Template does not own org-team-rbac internals.",
    "policy:no-local-rbac-module"
  );
  assert(
    !exists("src/lib/server/modules/billing-subscriptions/index.ts"),
    "Template does not own billing-subscriptions internals.",
    "policy:no-local-billing-module"
  );
}
