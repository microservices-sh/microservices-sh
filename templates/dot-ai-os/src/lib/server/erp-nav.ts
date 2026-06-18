import lockfile from "../../../microservices.lock.json";

// ── Lock-driven sidebar nav ────────────────────────────────────────────────
//
// DOT AI OS's left sidebar is DERIVED from the installed module set, not
// hardcoded. `microservices.lock.json#modules[]` is the source of truth for what
// is installed; this file maps the user-facing module ids to nav metadata and
// filters everything else out. Add/remove a module in the lock (the normal
// install flow) and its nav entry appears/disappears automatically — no edit to
// the layout component required.
//
// Infra modules (auth, identity, audit-log, jobs-workflows, notifications-inapp,
// gateway, idempotency, webhook-delivery) have no nav entry: they power the shell
// but expose no operational surface a user navigates to.

export interface NavItem {
  href: string;
  label: string;
}
export interface NavGroup {
  section?: string;
  items: NavItem[];
}

export interface LockModule {
  id: string;
  contract?: { mount?: string; permissions?: string[]; requires?: string[] };
}

// User-facing modules → sidebar metadata, grouped to match the web-portal/admin
// chrome (section title + items). A module is shown only if it is BOTH listed
// here AND installed (in the lock). Order here defines sidebar order.
const MODULE_NAV: Record<string, NavItem> = {
  customer: { label: "Contacts", href: "/app/customers" },
  invoice: { label: "Work packets", href: "/app/invoices" },
  "support-ticket": { label: "Support inbox", href: "/app/support" },
  "file-media": { label: "Files", href: "/app/files" },
  "org-team-rbac": { label: "Team", href: "/app/team" }
};

// Which modules belong to which sidebar group (operational vs organization).
const OPERATIONS = ["customer", "invoice", "support-ticket", "file-media"];
const ORGANIZATION = ["org-team-rbac"];

function installedModuleIds(): Set<string> {
  const modules = (lockfile.modules ?? []) as LockModule[];
  return new Set(modules.map((module) => module.id));
}

function itemsFor(moduleIds: string[], installed: Set<string>): NavItem[] {
  return moduleIds.filter((id) => installed.has(id) && MODULE_NAV[id]).map((id) => MODULE_NAV[id]);
}

// Build the grouped sidebar nav from the installed module set. Dashboard is
// always present; Settings always under Organization; Admin console only for
// super-admins. Empty groups are dropped.
export function buildNav(opts: { superAdmin?: boolean } = {}): NavGroup[] {
  const installed = installedModuleIds();

  const operations: NavGroup = {
    section: "Workbench",
    items: [
      { label: "Today", href: "/app" },
      { label: "Tasks", href: "/app/tasks" },
      { label: "Focus plan", href: "/app/focus" },
      { label: "Calendar", href: "/app/calendar" },
      { label: "Daily review", href: "/app/review" },
      { label: "Knowledge log", href: "/app/knowledge" },
      { label: "Content pipeline", href: "/app/content" },
      { label: "AI team", href: "/app/ai-team" },
      ...itemsFor(OPERATIONS, installed)
    ]
  };

  const organization: NavGroup = {
    section: "Workspace",
    items: [...itemsFor(ORGANIZATION, installed), { label: "Settings", href: "/app/settings" }]
  };

  const groups: NavGroup[] = [operations, organization];

  if (opts.superAdmin) {
    groups.push({ section: "System", items: [{ label: "Admin console", href: "/admin" }] });
  }

  return groups.filter((g) => g.items.length > 0);
}
