# Document Extraction Reference UI

Reference UI should expose:

- Upload or select an existing `file-media` file.
- Choose target schema (`invoice`, `receipt`, `intake-form`, `customer-document`, `support-evidence`, or custom).
- Run local extraction first when available.
- Show source text/evidence, field confidence, warnings, and runtime used.
- Require staff approval before writing approved output into target modules.

Never silently download a model or call a paid/provider-backed runtime without an
approval-gated UI state.

`Preview.svelte` provides an interactive local test surface for the module preview
harness. It simulates Gemma download/connect states and extraction review without
performing real model downloads, OCR, or provider calls.
