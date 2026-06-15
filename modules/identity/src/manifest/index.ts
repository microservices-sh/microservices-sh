export const manifest = {
  schemaVersion: "2026-06-13",
  id: "identity",
  name: "Identity",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary:
    "Passwordless email-code identity + server-side sessions, bridging to @microservices-sh/auth for short-lived scoped service tokens.",
  entrypoint: "src/index.ts",
} as const;

export const moduleDefinition = manifest;
