#!/usr/bin/env bash
# Local end-to-end research quickstart — no Fly needed.
#   OPENROUTER_API_KEY=sk-or-... ./quickstart.sh <client-folder> "<question>"
# Builds (or reuses) the graphify graph for the folder, loads it into an
# in-memory SQLite, boots the runtime, and prints a live cited brief.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"   # monorepo root (workspace deps resolve here)
cd "$ROOT"
ESB="node_modules/.pnpm/node_modules/.bin/esbuild"
[ -x "$ESB" ] || ESB="npx --yes esbuild"
OUT="$(mktemp -t research-quickstart-XXXX.mjs)"
$ESB packages/research-agent-runtime/scripts/quickstart.ts \
  --bundle --platform=node --format=esm --outfile="$OUT" >/dev/null
node "$OUT" "$@"
