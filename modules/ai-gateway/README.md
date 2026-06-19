# AI Gateway Module

Governed AI egress for microservices.sh. One provider-neutral boundary for
`embed` and `complete`, so research, decision, and agents call models through a
single audited, metered, capped, BYOK-aware layer.

## Why a shared module
- **BYOK in one place:** tenant picks provider + key reference; Workers AI is the keyless default.
- **Governance chokepoint:** fail-closed authz (`ai.invoke`), audit per call, approval-gateable.
- **Cost control:** per-tenant token budget — calls fail closed (429) when exhausted.
- **Metering:** every call emits token usage for billing.

## Use cases
- `complete({ messages, maxTokens?, temperature? }, deps)` → `{ text, usage, provider, model }`
- `embed({ texts }, deps)` → `{ vectors, usage, provider, model }`

Ports injected: `ProviderClient` (Workers AI / Anthropic / OpenAI / Gemini adapters),
`UsageMeter`, `Budget`, `AuditSink`. Prompts and cite-or-refuse live in the calling module, not here.
