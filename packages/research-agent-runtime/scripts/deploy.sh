#!/usr/bin/env bash
# Provision + deploy one client's research/advise agent to Fly.
#   OPENROUTER_API_KEY=sk-or-... ./deploy.sh <client-slug> [region]
# Idempotent-ish: re-running re-deploys; app/volume creation is skipped if present.
set -euo pipefail
CLIENT="${1:?usage: OPENROUTER_API_KEY=... deploy.sh <client-slug> [region]}"
REGION="${2:-iad}"
APP="${CLIENT}-research-agent"
: "${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY in the environment}"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"   # monorepo root = Docker build context
PKG="packages/research-agent-runtime"
cd "$ROOT"

fly apps create "$APP" 2>/dev/null || echo "app $APP already exists"
fly volumes list -a "$APP" 2>/dev/null | grep -q research_data \
  || fly volumes create research_data --size 1 --region "$REGION" -a "$APP" -y
fly secrets set \
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  RUNTIME_TOKEN="$(openssl rand -hex 32)" \
  OWNER_ID="$CLIENT" \
  -a "$APP"
fly deploy -a "$APP" --config "$PKG/fly.toml" --dockerfile "$PKG/Dockerfile"

cat <<NEXT

Deployed $APP.
1. Put the client's files on the volume (/data/sources), e.g. fly sftp / a sync job.
2. Build the knowledge graph:
     fly ssh console -a $APP -C "node /app/graph-build.mjs"
3. Query (token: fly secrets, or your own copy):
     curl -s https://$APP.fly.dev/research \\
       -H "Authorization: Bearer \$RUNTIME_TOKEN" \\
       -H "content-type: application/json" \\
       -d '{"question":"How does X work?"}'
NEXT
