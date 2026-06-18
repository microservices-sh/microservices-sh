export const manifest = {
  schemaVersion: "2026-06-13",
  id: "support-ticket",
  name: "Support Ticket",
  version: "0.1.0",
  status: "available",
  class: "core",
  summary:
    "Tenant-scoped support tickets with subject/description, an open->pending->resolved->closed status lifecycle, priority, assignment, and lifecycle events.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
