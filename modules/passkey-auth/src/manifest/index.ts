export const manifest = {
  schemaVersion: "2026-06-13",
  id: "passkey-auth",
  name: "Passkey Auth",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary:
    "Public, source-visible passkey (WebAuthn) authentication — registration + authentication ceremonies + credential management, built on @simplewebauthn/server. Verifies assertions and returns the verified userId; the host app mints the session.",
  entrypoint: "src/index.ts",
} as const;

export const moduleDefinition = manifest;
