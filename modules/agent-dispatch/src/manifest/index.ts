export const manifest = {
  schemaVersion: "2026-06-13",
  id: "agent-dispatch",
  name: "Agent Dispatch",
  version: "0.1.0",
  status: "draft",
  class: "platform",
  summary: "Runtime-neutral agent dispatch bridge with capability grants, one-time resume tokens, and workflow resume payloads.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
