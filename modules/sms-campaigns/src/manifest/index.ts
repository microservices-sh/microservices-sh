export const manifest = {
  schemaVersion: "2026-06-13",
  id: "sms-campaigns",
  name: "SMS Campaigns",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Tenant-scoped SMS campaign module for opted-in contacts, groups, reusable templates, provider configuration, scheduled sends, dispatch, and delivery callbacks.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
