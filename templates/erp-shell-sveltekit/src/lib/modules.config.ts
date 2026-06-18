// ── Enabled modules for THIS workspace ──────────────────────────────────────
//
// Turn operational modules on/off here. `null` = every installed module is
// enabled (the default). To restrict, list the module ids you want surfaced —
// e.g. ["customer", "invoice", "org-team-rbac"]. An omitted module has its
// sidebar entry hidden AND its /app routes return 404 (see lib/server/modules.ts).
//
// Only ids that are actually installed (present in microservices.lock.json) can
// be enabled — a typo here can never surface an unwired module.
//
// Deploy-time override: the ENABLED_MODULES env var (comma-separated ids) takes
// precedence over this file, so the same build can ship different module sets
// per environment without a code change.
export const enabledModules: string[] | null = null;
