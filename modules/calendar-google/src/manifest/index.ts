export const manifest = {
  schemaVersion: "2026-06-13",
  id: "calendar-google",
  name: "Google Calendar",
  version: "0.1.0",
  status: "available",
  class: "vertical",
  summary:
    "Google Calendar sync for Cloudflare Workers + D1: single-flight OAuth token refresh, watch-channel renewal before the ~7-day expiry, incremental syncToken sync with 410-Gone full-resync fallback, pure RRULE expansion, and push+poll dedup.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
