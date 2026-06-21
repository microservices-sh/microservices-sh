import { createResourceRegistry } from "@microservices-sh/admin-shell";
import type { ResourceRegistry } from "@microservices-sh/admin-shell";

// The super-admin (admin-shell) resource registry. Names/tables/columns are the
// ONLY identifiers used to build SQL — never request input — which is what keeps
// the generic table gateway injection-safe. Mirrors org-team-rbac's D1 tables.
export const adminRegistry: ResourceRegistry = createResourceRegistry([
  {
    name: "organizations",
    table: "organizations",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", label: "ID" },
      { name: "name", type: "string", label: "Name" },
      { name: "slug", type: "string", label: "Slug" },
      { name: "status", type: "string", label: "Status" },
      { name: "createdAt", type: "datetime", label: "Created" }
    ],
    searchable: ["name", "slug"],
    permissions: { read: "admin.read", write: "admin.write" },
    defaultSort: { column: "createdAt", direction: "desc" }
  },
  {
    name: "memberships",
    table: "memberships",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", label: "ID" },
      { name: "orgId", type: "string", label: "Org" },
      { name: "userId", type: "string", label: "User" },
      { name: "roleId", type: "string", label: "Role" },
      { name: "status", type: "string", label: "Status" },
      { name: "createdAt", type: "datetime", label: "Created" }
    ],
    searchable: ["orgId", "userId"],
    permissions: { read: "admin.read", write: "admin.write" },
    defaultSort: { column: "createdAt", direction: "desc" }
  }
]);
