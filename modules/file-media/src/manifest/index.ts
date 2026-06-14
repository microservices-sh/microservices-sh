export const manifest = {
  schemaVersion: "2026-06-13",
  id: "file-media",
  name: "File & Media",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary: "R2-backed file uploads with tenant-scoped keys, validated upload tickets, orphan cleanup, and soft-deletes. Async image variants fan out through jobs-workflows.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
