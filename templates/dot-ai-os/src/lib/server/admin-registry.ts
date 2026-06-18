import { createResourceRegistry } from "@microservices-sh/admin-shell";
import type { ResourceRegistry } from "@microservices-sh/admin-shell";

// The super-admin (admin-shell) resource registry. Names/tables/columns are the
// ONLY identifiers used to build SQL — never request input — which is what keeps
// the generic table gateway injection-safe. Each resource maps a module-owned D1
// table so admin-shell gives schema-driven CRUD without bespoke pages.
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
  },
  {
    // customer module D1 table (migrations/0003_customer.sql).
    name: "customers",
    table: "customers",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", label: "ID" },
      { name: "name", type: "string", label: "Name" },
      { name: "email", type: "string", label: "Email" },
      { name: "phone", type: "string", label: "Phone" },
      { name: "createdAt", type: "datetime", label: "Created" }
    ],
    searchable: ["name", "email"],
    permissions: { read: "admin.read", write: "admin.write" },
    defaultSort: { column: "createdAt", direction: "desc" }
  },
  {
    // invoice module D1 table (migrations/0004_invoice.sql).
    name: "invoices",
    table: "invoices",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", label: "ID" },
      { name: "number", type: "string", label: "Number" },
      { name: "customerId", type: "string", label: "Customer" },
      { name: "status", type: "string", label: "Status" },
      { name: "currency", type: "string", label: "Currency" },
      { name: "totalCents", type: "number", label: "Total (cents)" },
      { name: "createdAt", type: "datetime", label: "Created" }
    ],
    searchable: ["number", "customerId"],
    permissions: { read: "admin.read", write: "admin.write" },
    defaultSort: { column: "createdAt", direction: "desc" }
  }
]);
