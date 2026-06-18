import { enabledModuleIds } from "./modules";

// ── Enabled-driven sidebar nav ─────────────────────────────────────────────
//
// The ERP shell's left sidebar is DERIVED from the ENABLED module set, not
// hardcoded. A module appears only if it is BOTH mapped here (user-facing) AND
// enabled for this workspace (installed + turned on — see lib/server/modules.ts).
// Toggle a module in src/lib/modules.config.ts (or ENABLED_MODULES) and its nav
// entry appears/disappears — no edit to the layout component required.
//
// Infra modules (auth, identity, email, gateway, audit-log, jobs-workflows,
// idempotency, webhook-delivery) have no entry here: they power the shell but
// expose no surface a user navigates to.

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
  customer: { label: "Customers", href: "/app/customers" },
  invoice: { label: "Invoices", href: "/app/invoices" },
  payment: { label: "Payments", href: "/app/payments" },
  "billing-subscriptions": { label: "Billing", href: "/app/billing" },
  "support-ticket": { label: "Support", href: "/app/support" },
  "notifications-inapp": { label: "Notifications", href: "/app/notifications" },
  "file-media": { label: "Files", href: "/app/files" },
  "org-team-rbac": { label: "Team", href: "/app/team" }
};

// Which modules belong to which sidebar group (operational vs organization).
const OPERATIONS = ["customer", "invoice", "payment", "billing-subscriptions", "support-ticket", "notifications-inapp", "file-media"];
const ORGANIZATION = ["org-team-rbac"];

function itemsFor(moduleIds: string[], enabled: Set<string>): NavItem[] {
  return moduleIds.filter((id) => enabled.has(id) && MODULE_NAV[id]).map((id) => MODULE_NAV[id]);
}

// Build the grouped sidebar nav from the ENABLED module set. Dashboard is always
// present; Settings always under Organization; Admin console only for
// super-admins. Empty groups are dropped.
export function buildNav(opts: { superAdmin?: boolean; platform?: App.Platform } = {}): NavGroup[] {
  const enabled = enabledModuleIds(opts.platform);

  const operations: NavGroup = {
    section: "Operations",
    items: [{ label: "Dashboard", href: "/app" }, ...itemsFor(OPERATIONS, enabled)]
  };

  const organization: NavGroup = {
    section: "Organization",
    items: [...itemsFor(ORGANIZATION, enabled), { label: "Settings", href: "/app/settings" }]
  };

  const groups: NavGroup[] = [operations, organization];

  if (opts.superAdmin) {
    groups.push({ section: "System", items: [{ label: "Admin console", href: "/admin" }] });
  }

  return groups.filter((g) => g.items.length > 0);
}
