#!/usr/bin/env bash
# Demonstrates the L5 route guard catching a cross-tenant regression. Plants the
# exact mistake an AI agent makes — a route that imports the raw, input-trusting
# tenant use-case — into a real template, runs the guard, shows it go red, then
# reverts. Leaves your working tree clean. Exit 0 = the guard caught it.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="templates/erp-shell-sveltekit"
PLANT_DIR="$ROOT/$TEMPLATE/src/routes/_proof_regression"
PLANT_FILE="$PLANT_DIR/+page.server.ts"

cleanup() { rm -rf "$PLANT_DIR"; }
trap cleanup EXIT

mkdir -p "$PLANT_DIR"
cat > "$PLANT_FILE" <<'TS'
// A naive agent-written route: tenant trusted from the request → cross-tenant leak.
import { listInvoices } from "@microservices-sh/invoice";
export const load = async ({ url, locals }) => {
  // BUG: tenantId comes from the request, not the session.
  const tenantId = url.searchParams.get("tenantId") ?? "";
  return listInvoices({ tenantId }, { invoiceStore: locals.invoiceStore });
};
TS

echo "→ Planted a raw, input-trusting tenant call into $TEMPLATE/src/routes/_proof_regression/"
echo "→ Running the L5 guard (pnpm spec:check)…"
echo

output="$(cd "$ROOT" && node packages/workspace-tools/src/index.js check template --path "$TEMPLATE" 2>&1)"
rc=$?

if [ $rc -ne 0 ] && echo "$output" | grep -q "enforced-tenant-boundary\|raw input-trusting"; then
  echo "$output" | grep -iE "enforced-tenant-boundary|raw input-trusting|_proof_regression" | sed 's/^/    /'
  echo
  echo "✓ BUILD WENT RED — the guard caught the cross-tenant regression before it could ship."
  echo "  (planted file removed; your tree is clean)"
  exit 0
fi

echo "$output"
echo
echo "✗ Unexpected: the guard did not flag the planted leak. Investigate before trusting this proof."
exit 1
