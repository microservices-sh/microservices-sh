export const manifest = {
  schemaVersion: "2026-06-13",
  id: "support-ticket",
  name: "Support Ticket",
  version: "0.1.0",
  status: "available",
  class: "core",
  summary:
    "Tenant-scoped support tickets with sequence numbers, lifecycle state, priority, assignment, comments, attachment metadata, and public follow-up links.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
