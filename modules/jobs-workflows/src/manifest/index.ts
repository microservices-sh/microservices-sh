export const manifest = {
  schemaVersion: "2026-06-13",
  id: "jobs-workflows",
  name: "Jobs & Workflows",
  version: "0.1.0",
  status: "available",
  class: "platform",
  summary: "Durable background jobs with idempotent execution, exponential-backoff retries, a dead-letter sink, and catch-up scheduling. The async backbone other modules build on.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
