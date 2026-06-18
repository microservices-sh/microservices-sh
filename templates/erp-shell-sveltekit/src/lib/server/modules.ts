import { error } from "@sveltejs/kit";
import lockfile from "../../../microservices.lock.json";
import { enabledModules as configuredModules } from "$lib/modules.config";

// ── Installed vs enabled ────────────────────────────────────────────────────
//
// INSTALLED = vendored + wired into the app (present in microservices.lock.json).
// This is the universe a workspace can choose from.
//
// ENABLED   = surfaced in THIS deployment. Precedence:
//   1. ENABLED_MODULES env (comma-separated ids) — deploy-time override
//   2. src/lib/modules.config.ts                  — committed per-workspace choice
//   3. all installed                              — default
// The result is always intersected with INSTALLED, so a stray id can never
// enable a module that isn't actually wired.

type LockModule = { id: string };

export function installedModuleIds(): Set<string> {
  return new Set(((lockfile.modules ?? []) as LockModule[]).map((m) => m.id));
}

export function enabledModuleIds(platform?: App.Platform): Set<string> {
  const installed = installedModuleIds();
  const envRaw = (platform?.env as { ENABLED_MODULES?: string } | undefined)?.ENABLED_MODULES;
  const list =
    envRaw != null ? envRaw.split(",").map((s) => s.trim()).filter(Boolean) : configuredModules;
  if (!list) return installed; // null / unset → every installed module is enabled
  return new Set(list.filter((id) => installed.has(id)));
}

export function isModuleEnabled(id: string, platform?: App.Platform): boolean {
  return enabledModuleIds(platform).has(id);
}

// Route guard: 404 a module's pages when it isn't enabled, so disabling a module
// is real (routes blocked) and not just a hidden sidebar link. Call it first in
// a module route's load().
export function requireModule(id: string, platform?: App.Platform): void {
  if (!isModuleEnabled(id, platform)) {
    throw error(404, "This module is not enabled for this workspace.");
  }
}
