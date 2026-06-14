export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_org_team_rbac.sql",
    "CREATE TABLE IF NOT EXISTS organizations",
    "Org-team-rbac migration owns the organizations table."
  );
  assertFileIncludes(
    "migrations/0001_org_team_rbac.sql",
    "idx_memberships_org_user",
    "Membership is uniquely keyed by (org, user) — the tenant-scoped lookup."
  );
  assertFileIncludes(
    "src/use-cases/authorize.ts",
    "return [];",
    "A non-member resolves to no permissions (tenant isolation boundary)."
  );
  assertFileIncludes(
    "src/use-cases/accept-invitation.ts",
    "INVITATION_USED",
    "Invitations are single-use (a non-pending token is rejected)."
  );
}
