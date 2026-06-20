# Plan 33 — ERP Shell Desktop Companion

*Status: draft MVP created and Linux-native validated (2026-06-20). Defines the
roadmap for `templates/erp-shell-desktop-tauri` as a desktop companion to
`templates/erp-shell-sveltekit`, focused on local document intake, review, and
approved sync.*

## Thesis

The desktop opportunity is not "ERP, but offline." The valuable wedge is a
local intake bridge for businesses that still receive messy files: scanned
invoices, receipts, onboarding forms, service photos, statements, and support
evidence. The cloud ERP remains the governed system of record; the desktop app
owns local files, local draft extraction state, optional local OCR/LLM runtime
control, and user-approved sync.

That split matters commercially. It gives privacy-sensitive SMBs a credible
local processing story without forking the ERP product into two databases.

## Current Implementation

- Template: `templates/erp-shell-desktop-tauri`
- Framework: Tauri v2 + Svelte + Rust.
- UI modes: browser preview and Tauri desktop shell.
- Rust commands: runtime status, sync status, import folder stub, sample queue.
- Docker check: Debian image with WebKitGTK/GTK, pnpm `10.33.0`, Rust/Cargo
  `1.95.0`.
- Validation: local Vite build, template check, and Docker Linux `cargo check`
  pass.

## Product Boundary

The desktop app may:

- read local folders and files after explicit user selection
- maintain local draft extraction state
- supervise local OCR/model sidecars
- show confidence and review state
- sync approved drafts to a configured ERP Shell backend

The desktop app must not:

- become the canonical store for invoices, customers, support tickets, or
  bookings
- write production ERP records without user approval
- silently download model weights
- bypass module APIs or audit requirements

## Deployment Modes

| Mode | Description | Target |
|---|---|---|
| `browser-preview` | Static UI preview through Vite. | Built |
| `desktop-connected` | Local drafts plus backend sync. | First shippable desktop beta |
| `desktop-local-first` | Offline queue/review, sync later. | Second beta |
| `offline-extraction` | Local OCR and local LLM extraction. | Premium/private workflow |

## Architecture Direction

```
local files
  -> Rust file intake
  -> local SQLite draft queue
  -> OCR/text extraction adapter
  -> optional local LLM adapter
  -> Svelte review UI
  -> approved sync client
  -> ERP Shell backend module APIs
```

Rust owns native capabilities: filesystem access, SQLite, process supervision,
model/runtime adapters, and sync transport. Svelte owns rendering and review
workflow. ERP Shell modules own production domain behavior.

## Model Strategy

Local LLM support should be adapter-based:

- `Ollama` for the lowest setup friction.
- `llama.cpp` or GGUF runners when tighter packaging/control is needed.
- Cloud fallback through the existing AI gateway for users who do not want local
  runtime setup.
- Gemma-family models can be supported through those adapters, but the product
  should not depend on one model brand.

Default installers should not include large model weights. Downloads must be
explicit, resumable, versioned, and reversible.

## Module Dependencies

Desktop sync should reuse existing module boundaries:

- `document-extraction` for extraction jobs/results.
- `file-media` for source file metadata and storage references.
- `invoice`, `customer`, `support-ticket`, and `jobs-workflows` for mapped
  records.
- `auth` and `org-team-rbac` for workspace identity and permissions.
- `audit-log` for approve/sync events.
- `idempotency` for retry-safe sync.
- `ai-gateway` when using remote model fallback.

## Roadmap

| Phase | Scope | Exit gate |
|---|---|---|
| P0 | Desktop shell MVP | Built, checks pass |
| P1 | Native folder picker, drag/drop, SQLite draft queue, hashing | Local import survives restart and dedupes files |
| P2 | OCR, classification, extraction review UI | Scanned invoice can become a reviewed editable draft |
| P3 | Local runtime manager and model adapters | Runtime detection, explicit model install, local extraction path |
| P4 | Governed sync to ERP Shell APIs | Approved drafts sync idempotently with audit trail |
| P5 | Signed macOS/Windows distribution | Signed installers and upgrade path tested |

## Pilot Use Cases

Prioritize pilots where the buyer already pays for manual data entry:

- accounting offices processing vendor invoices and receipts
- service businesses collecting repair photos and signed forms
- clinics or consultants receiving onboarding packets
- property managers processing statements, deposits, and receipts
- support teams attaching evidence to customer cases

Success metric: minutes saved per document batch after review, not raw OCR
accuracy in isolation.

## Acceptance Metrics

- Time from folder selection to reviewed draft.
- Percentage of fields requiring manual correction.
- Sync failure recovery rate.
- Duplicate detection rate.
- Local runtime setup completion rate.
- Installer success rate on macOS and Windows.

## Open Questions

1. Native SQLite crate/plugin choice for Tauri v2.
2. Whether first OCR adapter should be local-only, cloud fallback, or both.
3. Minimum viable sync API shape for `document-extraction` and `file-media`.
4. How much model management belongs in the desktop app versus an external
   runtime such as Ollama.
5. Whether desktop should be an official template only or also a published
   standalone application for non-developer operators.

## Next Actions

1. Implement real folder selection through a Tauri dialog plugin.
2. Add a Rust-owned SQLite draft queue and expose queue commands to Svelte.
3. Add import hashing/deduplication tests.
4. Define sync draft payloads for `document-extraction` and `file-media`.
5. Add macOS and Windows packaging CI after the local intake path works.
