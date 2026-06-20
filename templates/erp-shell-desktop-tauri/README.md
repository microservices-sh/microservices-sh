# ERP Shell Desktop Tauri

Desktop companion MVP for the microservices.sh ERP Shell. It gives Mac and
Windows users a local intake workspace for document folders, extraction jobs,
runtime status, and sync readiness before approved records are pushed into a
deployed ERP Shell app.

This is intentionally not a fully offline ERP. The first desktop slice is a
local bridge: keep files and draft extraction state on the machine, then sync
reviewed records into the governed Cloudflare app.

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
- Rust commands for folder selection, drag/drop path import, SQLite queue
  persistence, runtime status, and sync status.
- Browser preview fallback so the interface can be reviewed without launching
  Tauri.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md) for product modes, milestones,
acceptance criteria, and the next engineering slice.

## Next

- Add watched folder configuration.
- Add document-extraction module sync endpoints.
- Add local OCR/model sidecar supervision.
- Add signed release builds for macOS and Windows.
