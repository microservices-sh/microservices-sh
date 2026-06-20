#!/usr/bin/env bash
set -euo pipefail

readonly SCRATCH_DIR="/workspace"
readonly HOST_DIR="/host"
readonly TEMPLATE_PACKAGE="@microservices-sh/template-erp-shell-desktop-tauri"

copy_host_workspace() {
  if [ ! -d "$HOST_DIR" ]; then
    return
  fi

  mkdir -p "$SCRATCH_DIR"

  cd "$HOST_DIR"
  tar \
    --exclude="./node_modules" \
    --exclude="./templates/erp-shell-desktop-tauri/node_modules" \
    --exclude="./templates/erp-shell-desktop-tauri/dist" \
    --exclude="./templates/erp-shell-desktop-tauri/src-tauri/target" \
    --exclude="./microservices-sh/node_modules" \
    --exclude="./microservices-sh/templates/erp-shell-desktop-tauri/node_modules" \
    --exclude="./microservices-sh/templates/erp-shell-desktop-tauri/dist" \
    --exclude="./microservices-sh/templates/erp-shell-desktop-tauri/src-tauri/target" \
    -cf /tmp/workspace.tar .

  cd "$SCRATCH_DIR"
  tar -xf /tmp/workspace.tar
}

workspace_dir() {
  if [ -f package.json ] && [ -d templates ]; then
    printf "."
    return
  fi

  printf "microservices-sh"
}

run_checks() {
  local workspace
  workspace="$(workspace_dir)"

  pnpm --dir "$workspace" install --ignore-scripts
  pnpm --dir "$workspace" --filter "$TEMPLATE_PACKAGE" build
  pnpm --dir "$workspace" --filter "$TEMPLATE_PACKAGE" test:rust
  cargo check --manifest-path "$workspace/templates/erp-shell-desktop-tauri/src-tauri/Cargo.toml"
}

cd "$SCRATCH_DIR"
copy_host_workspace
run_checks
