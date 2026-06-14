export const manifest = {
  schemaVersion: "2026-06-13",
  id: "notifications-inapp",
  name: "In-App Notifications",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary:
    "Per-user in-app notification feed: user-scoped lists/counts, read/unread state, polymorphic typed payloads, reconnect catch-up, and idempotent delivery via dedupKey.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
