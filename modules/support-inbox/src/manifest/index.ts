export const manifest = {
  schemaVersion: "2026-06-13",
  id: "support-inbox",
  name: "Support Inbox",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped support widget and inbox module for widget settings, quick actions, conversations, messages, channel metadata, and agent takeover.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
