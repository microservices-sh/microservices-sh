#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-studio-booking}"
TEMPLATE="${TEMPLATE:-booking-sveltekit}"
DEMO_ROOT="${DEMO_ROOT:-/tmp/microservices-sh-demo}"
MODE="${MODE:-public}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${DEMO_ROOT}/${APP_NAME}"

usage() {
  cat <<'EOF'
Usage:
  bash docs/promotion/demo-terminal-runner.sh clean
  bash docs/promotion/demo-terminal-runner.sh prep
  bash docs/promotion/demo-terminal-runner.sh serve
  bash docs/promotion/demo-terminal-runner.sh checks
  bash docs/promotion/demo-terminal-runner.sh approval-gate
  bash docs/promotion/demo-terminal-runner.sh mcp-config
  bash docs/promotion/demo-terminal-runner.sh cues

Environment:
  APP_NAME    Demo app directory name. Default: studio-booking
  TEMPLATE    Template id. Default: booking-sveltekit
  DEMO_ROOT   Parent output directory. Default: /tmp/microservices-sh-demo
  MODE        public uses npm create; local uses this checkout. Default: public
EOF
}

ensure_app() {
  if [ ! -d "$APP_DIR" ]; then
    echo "Missing demo app: $APP_DIR" >&2
    echo "Run: bash docs/promotion/demo-terminal-runner.sh prep" >&2
    exit 1
  fi
}

clean() {
  rm -rf "$APP_DIR"
  mkdir -p "$DEMO_ROOT"
  echo "Cleaned $APP_DIR"
}

prep() {
  rm -rf "$APP_DIR"
  mkdir -p "$DEMO_ROOT"

  if [ "$MODE" = "local" ]; then
    echo "Scaffolding from local checkout..."
    (cd "$REPO_ROOT" && pnpm create:local "$APP_DIR" --template "$TEMPLATE")
  else
    echo "Scaffolding from npm..."
    (cd "$DEMO_ROOT" && npm create microservices-app@latest "$APP_NAME" -- --template "$TEMPLATE")
  fi

  (cd "$APP_DIR" && pnpm install)
  echo
  echo "Demo app ready: $APP_DIR"
  echo "Next: bash docs/promotion/demo-terminal-runner.sh serve"
}

serve() {
  ensure_app
  cd "$APP_DIR"
  echo "Starting generated app from $APP_DIR"
  echo "Open the printed localhost URL in the browser."
  exec pnpm dev
}

checks() {
  ensure_app
  cd "$APP_DIR"
  echo '$ pnpm microservices modules list --json'
  pnpm microservices modules list --json
  echo
  echo '$ pnpm microservices docs booking'
  pnpm microservices docs booking
  echo
  echo '$ pnpm microservices check --json'
  pnpm microservices check --json
}

approval_gate() {
  ensure_app
  cd "$APP_DIR"
  echo '$ pnpm microservices deploy run --help'
  set +e
  pnpm microservices deploy run --help
  status="$?"
  set -e
  echo
  echo "Approval gate shown. Non-zero exit status ${status} is expected here because deploy actions require explicit confirmation."
}

mcp_config() {
  cat <<'EOF'
Official MCP Registry:
  sh.microservices/mcp
  https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp

npm:
  npx -y @microservices-sh/mcp

MCP client config:
{
  "mcpServers": {
    "microservices": {
      "command": "npx",
      "args": ["-y", "@microservices-sh/mcp"],
      "env": {
        "MICROSERVICES_API_URL": "https://api.microservices.sh"
      }
    }
  }
}
EOF
}

cues() {
  cat <<'EOF'
0-10s  Agents can build UI fast. Production foundations are the risky part.
10-25s npm create microservices-app@latest studio-booking -- --template booking-sveltekit
25-45s Show generated app, docs/modules/booking.md, and microservices.lock.json.
45-65s Run modules list, docs booking, and check.
65-82s Show MCP config and official registry: sh.microservices/mcp.
82-95s Show deploy confirmation gate. Emphasize approval-gated deploys.
EOF
}

case "${1:-help}" in
  clean) clean ;;
  prep) prep ;;
  serve) serve ;;
  checks) checks ;;
  approval-gate) approval_gate ;;
  mcp-config) mcp_config ;;
  cues) cues ;;
  help|--help|-h) usage ;;
  *)
    usage >&2
    exit 2
    ;;
esac
