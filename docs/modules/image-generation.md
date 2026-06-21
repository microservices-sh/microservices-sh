# Image Generation

Status: available
Module ID: `image-generation`
Mount: `/images`

## Summary
Text-to-image generation and editing across pluggable providers. Stores gallery metadata in D1, image bytes in R2, and supports configurable default provider selection with fallback.

## Dependencies
- none

Optional integrations:

- auth
- audit-log

## Permissions
- image.generate
- image.read
- image.admin
- image.extend
- image.observe

## Secrets
- KIEAI_API_KEY
- GEMINI_AUTH_TOKEN
- OPENAI_API_KEY

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)
- R2 (`IMAGE_BUCKET`)

Tables:

- image_generations

## Hooks
- beforeGenerate
- onImageGenerated

## Events
Emits:

- image.generated
- image.edited
- image.deleted

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
