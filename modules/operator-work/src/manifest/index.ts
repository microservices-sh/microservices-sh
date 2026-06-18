export const manifest = {
  schemaVersion: "2026-06-13",
  id: "operator-work",
  name: "Operator Work",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary: "Agent-readable task board, focus plan, daily review, and auditable operator work state for DOT AI OS.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
