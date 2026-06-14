export const manifest = {
  schemaVersion: "2026-06-13",
  id: "forms-intake",
  name: "Forms & Intake",
  version: "0.1.0",
  status: "available",
  class: "vertical",
  summary:
    "Dynamic form builder + intake: serializable field schemas with validation rules and conditional visibility, pure submission validation, idempotent submissions, optional Turnstile spam protection, and content-type/size-validated attachment references.",
  entrypoint: "src/index.ts"
} as const;

export const moduleDefinition = manifest;
