import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Walk up to the workspace root (the dir holding pnpm-workspace.yaml).
function workspaceRoot() {
  let current = dirname(fileURLToPath(import.meta.url));
  while (current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    current = dirname(current);
  }
  throw new Error("workspace root not found");
}

// The SvelteKit project shims are generated from one canonical template. This
// guard fails CI when any committed shim drifts from it, so booking/saas/portal
// and the bundled shim can never silently diverge again. Run `pnpm sync:shims`
// to regenerate after editing the canonical template.
test("project shims are in sync with the canonical template", () => {
  const root = workspaceRoot();
  const tool = resolve(root, "packages/workspace-tools/src/index.js");
  const result = spawnSync("node", [tool, "shims", "check", "--json"], {
    cwd: root,
    encoding: "utf8"
  });

  const payload = JSON.parse(result.stdout || "{}");
  assert.equal(
    payload.ok,
    true,
    `shim drift detected — run "pnpm sync:shims":\n${result.stdout}${result.stderr}`
  );
  assert.ok(payload.data.shims.targets.every((t) => t.status === "in-sync"));
});
