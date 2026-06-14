export const manifest = {
  schemaVersion: "2026-06-13",
  id: "auth",
  name: "Auth",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary: "EdDSA service-token mint/verify, scope checks, and JWKS for auth-gated inter-service communication.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
