export const manifest = {
  schemaVersion: "2026-06-13",
  id: "image-generation",
  name: "Image Generation",
  version: "0.1.0",
  status: "available",
  class: "provider",
  summary:
    "Text-to-image generation and editing across pluggable providers (kie.ai nano-banana, Gemini, GPT-image). R2-backed image bytes with tenant-scoped keys, D1 gallery metadata, configurable default provider + fallback.",
  entrypoint: "src/index.ts",
} as const;

export const moduleDefinition = manifest;
