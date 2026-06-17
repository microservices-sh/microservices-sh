import lockfile from "../../../microservices.lock.json";

// ── Lock-driven sidebar nav ────────────────────────────────────────────────
//
// The ERP shell's left sidebar is DERIVED from the installed module set, not
// hardcoded. `microservices.lock.json#modules[]` is the source of truth for what
// is installed; this file maps the user-facing module ids to nav metadata and
// filters everything else out. Add/remove a module in the lock (the normal
// install flow) and its nav entry appears/disappears automatically — no edit to
// the layout component required.
//
// Infra modules (auth, identity, audit-log, jobs-workflows, notifications-inapp,
// gateway, idempotency, webhook-delivery) have no nav entry: they power the shell
// but expose no operational surface a user navigates to. They simply have no
// entry in NAV_BY_MODULE below, so they are filtered out.

export interface NavEntry {
  /** Module id this entry is derived from (matches lock modules[].id). */
  moduleId: string;
  label: string;
  href: string;
  /** Single-glyph icon rendered in the sidebar (kit-styled, no icon dep). */
  icon: string;
}

export interface LockModule {
  id: string;
  contract?: {
    mount?: string;
    permissions?: string[];
    requires?: string[];
  };
}

// User-facing modules → sidebar metadata. A module id present here AND installed
// (in the lock) gets a sidebar entry. Order here defines sidebar order.
const NAV_BY_MODULE: Record<string, Omit<NavEntry, "moduleId">> = {
  customer: { label: "Customers", href: "/app/customers", icon: "◷" },
  invoice: { label: "Invoices", href: "/app/invoices", icon: "▤" },
  "file-media": { label: "Files", href: "/app/files", icon: "▢" },
  "org-team-rbac": { label: "Team", href: "/app/team", icon: "◍" }
};

// Static entries the shell always shows regardless of module set: the dashboard
// (the shell itself) and settings (org profile + activity).
const SHELL_HOME: NavEntry = { moduleId: "__shell__", label: "Dashboard", href: "/app", icon: "▣" };
const SHELL_SETTINGS: NavEntry = { moduleId: "__shell__", label: "Settings", href: "/app/settings", icon: "⚙" };

function installedModuleIds(): Set<string> {
  const modules = (lockfile.modules ?? []) as LockModule[];
  return new Set(modules.map((module) => module.id));
}

// Build the sidebar nav from the installed module set. Dashboard first, then one
// entry per installed user-facing module (in NAV_BY_MODULE order), Settings last.
export function buildNav(): NavEntry[] {
  const installed = installedModuleIds();
  const moduleEntries: NavEntry[] = Object.entries(NAV_BY_MODULE)
    .filter(([moduleId]) => installed.has(moduleId))
    .map(([moduleId, meta]) => ({ moduleId, ...meta }));

  return [SHELL_HOME, ...moduleEntries, SHELL_SETTINGS];
}
