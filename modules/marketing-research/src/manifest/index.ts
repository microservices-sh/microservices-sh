export const manifest = {
  schemaVersion: "2026-06-13",
  id: "marketing-research",
  name: "Marketing Research",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary:
    "Composable, cited marketing research with swappable signal and synthesis ports plus cite-or-refuse guardrails.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
