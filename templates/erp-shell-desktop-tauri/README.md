# ERP Shell Desktop Tauri

Desktop companion MVP for the microservices.sh ERP Shell. It gives Mac and
Windows users a local intake workspace for document folders, extraction jobs,
runtime status, and ERP import readiness before approved records are submitted to a
deployed ERP Shell app.

This is intentionally not a fully offline ERP. The first desktop slice is a
local bridge: keep files and draft extraction state on the machine, then submit
reviewed records into the governed Cloudflare app. The remote ERP database is
canonical for multi-user business records.

## Commands

```bash
pnpm install
pnpm dev
pnpm dev:desktop
pnpm build
pnpm build:desktop
pnpm test:rust
pnpm check:spec
pnpm microservices check --json
```

## macOS Development

Install Xcode Command Line Tools and Rust first:

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install 1.88.0
rustup default 1.88.0
```

The template also includes `rust-toolchain.toml`, so `cargo` and `pnpm
dev:desktop` use Rust `1.88.0` when run from this directory. If Cargo reports
that crates such as `darling`, `plist`, `serde_with`, or `time` require Rust
`1.88.0`, update the Mac's Rust toolchain with the commands above.

## Local OCR and Gemma

The desktop template now includes the first local extraction adapter:

- scanned image OCR runs through a local `tesseract` command when installed;
- scanned image text is saved as a local `document-extraction` shaped draft;
- when Tesseract is not installed, an installed Gemma vision-capable Ollama
  model can extract directly from scanned page images;
- Gemma normalization is attempted only when a configured local Ollama model is
  already present and reachable;
- the Runtime Settings page can save the selected Gemma model/OCR language,
  run an explicit Ollama model install, and test the selected model before
  extraction;
- the app never downloads model weights silently and does not bundle LLM weights
  in the default installer.

For a Mac pilot:

```bash
brew install tesseract
brew install --cask ollama
pnpm dev:desktop
```

Then open Runtime Settings, select a Gemma model and OCR language, and click
`Install Model`. Use `Test Model` to confirm the selected Ollama model responds
before running extraction. If your Ollama library uses a different Gemma 4 tag,
enter it in the custom model field before installing. Without Tesseract, the app
uses Gemma vision when the selected model is installed and responds. Without
Ollama/Gemma, OCR still works through Tesseract and the app falls back to
deterministic review fields.

## Linux Docker Check

The host machine needs GTK/WebKit development packages to compile Tauri on
Linux. If those packages are not installed locally, use the Docker check image:

```bash
docker build -f templates/erp-shell-desktop-tauri/Dockerfile.linux-check -t msh-erp-desktop-linux-check .
docker run --rm -v "$PWD:/host:ro" msh-erp-desktop-linux-check
```

This validates the web bundle and native Rust/Tauri shell in a Debian container.
The container copies the mounted workspace into an internal scratch directory
before installing dependencies, so host `node_modules`, `dist`, and Cargo
`target` directories are left alone.

## MVP Scope

- Svelte/Vite desktop UI.
- Shared ERP Shell UI tokens and component primitives vendored under
  `src/lib/ui`, including the canonical `AppShell` sidebar and `Logo`.
- Tauri shell for macOS and Windows bundles.
- Rust commands for file/folder selection, drag/drop path import, SQLite queue
  persistence, runtime status, PDF rasterization + local OCR extraction, optional
  local Gemma vision/normalization, runtime settings, explicit model install,
  selected-model readiness tests, audited field correction / approve / reject,
  and remote ERP import status.
- PDF intake: multi-page PDFs are rasterized with poppler `pdftoppm` and OCR'd
  page by page (the first document-heavy vertical is invoices, which are mostly
  PDF).
- Human-in-the-loop review: edit extracted field values inline, then approve or
  reject a draft. Edits and decisions are written to a local `draft_edits` audit
  table, and only approved drafts can be submitted to the ERP Worker.
- Remote ERP import: configure an ERP app URL plus desktop import token, submit
  approved drafts to `/api/desktop/import`, and mark the local draft imported
  only after the Worker accepts the request.
- Browser preview fallback so the interface can be reviewed without launching
  Tauri.

Requires poppler (`pdftoppm`, `pdfinfo`) on PATH for PDF intake. Tesseract is
optional when a vision-capable Gemma model is installed; without both Tesseract
and Gemma, files still queue and the draft carries a setup warning.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md) for product modes, milestones,
acceptance criteria, and the next engineering slice.

## Next

- Add line-item table extraction and deterministic field validators (replace
  fabricated heuristic confidence as the review signal).
- Add source-region bounding boxes and a document-image preview in review.
- Add watched folder configuration.
- Add richer document-extraction module import processors for approved drafts.
- Add signed release builds for macOS and Windows.
