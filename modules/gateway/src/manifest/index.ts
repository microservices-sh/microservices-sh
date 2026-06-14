export const manifest = {
  schemaVersion: "2026-06-13",
  id: "gateway",
  name: "Gateway",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary: "Public trust boundary: API-key authentication, rate limiting, scope narrowing, and token exchange via auth.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
