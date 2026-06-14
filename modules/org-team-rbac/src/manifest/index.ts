export const manifest = {
  schemaVersion: "2026-06-13",
  id: "org-team-rbac",
  name: "Org, Team & RBAC",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary: "Multi-tenant organizations, memberships, roles, and invitations with a permission-resolution gate. Enforces tenant isolation and single-use, expiring invites — the B2B foundation other modules scope against.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
