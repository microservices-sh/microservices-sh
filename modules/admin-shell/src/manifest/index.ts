export const manifest = {
  schemaVersion: "2026-06-13",
  id: "admin-shell",
  name: "Admin Shell",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary: "Schema-driven admin CRUD over your existing D1 tables: a resource registry plus generic list/get/create/update/delete with RBAC, soft-delete, search/pagination, and audit hooks. UI is host-rendered.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
