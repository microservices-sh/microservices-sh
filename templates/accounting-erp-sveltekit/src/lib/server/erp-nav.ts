import { enabledModuleIds } from "./modules";

// ── Enabled-driven, GROUPED sidebar nav ────────────────────────────────────
//
// The ERP shell's left sidebar is DERIVED from the ENABLED module set, not
// hardcoded. A module appears only if it is BOTH mapped here (user-facing) AND
// enabled for this workspace (installed + turned on — see lib/server/modules.ts).
// Items are organised into thematic groups (Overview / Customers / Billing /
// Marketing / Automation / Workspace) so the sidebar scales past a flat list.
//
// CONFIGURATION lives in the Settings hub (/app/settings/*), NOT here — see
// lib/server/settings-nav.ts. Team management is org configuration, so it is no
// longer a top-level entry; it lives under Settings → Workspace → Team.

export interface NavItem {
  href: string;
  label: string;
  /** Icon name resolved by the AppShell's icon set (Lucide-style). */
  icon?: string;
}
export interface NavGroup {
  section?: string;
  items: NavItem[];
}

export interface LockModule {
  id: string;
  contract?: { mount?: string; permissions?: string[]; requires?: string[] };
}

// User-facing modules → sidebar metadata. A module is shown only if it is BOTH
// listed here AND enabled. `org-team-rbac` is intentionally absent: team
// management is configuration and lives in the Settings hub.
const MODULE_NAV: Record<string, NavItem> = {
  customer: { label: "Customers", href: "/app/customers", icon: "users" },
  "accounting-core": { label: "Ledger", href: "/app/ledger", icon: "book-open" },
  "accounts-payable": { label: "Payables", href: "/app/payables", icon: "receipt" },
  "accounts-receivable": { label: "Receivables", href: "/app/receivables", icon: "file-text" },
  "bank-reconciliation": { label: "Banking", href: "/app/banking", icon: "landmark" },
  "estimate-quote": { label: "Quotes", href: "/app/quotes", icon: "clipboard" },
  invoice: { label: "Invoices", href: "/app/invoices", icon: "file-text" },
  payment: { label: "Payments", href: "/app/payments", icon: "credit-card" },
  "support-ticket": { label: "Support", href: "/app/support", icon: "life-buoy" },
  "notifications-inapp": { label: "Notifications", href: "/app/notifications", icon: "bell" },
  "jobs-workflows": { label: "Jobs", href: "/app/jobs", icon: "workflow" },
  "webhook-delivery": { label: "Webhooks", href: "/app/webhooks", icon: "webhook" },
  "file-media": { label: "Files", href: "/app/files", icon: "folder" }
};

// Thematic groups (ordered). Each lists the ordered module ids it contains;
// only enabled ones render, and empty groups are dropped.
const GROUPS: { section: string; modules: string[] }[] = [
  { section: "Accounting", modules: ["accounting-core", "accounts-payable", "accounts-receivable", "bank-reconciliation"] },
  { section: "Customers", modules: ["customer", "support-ticket"] },
  { section: "Billing", modules: ["estimate-quote", "invoice", "payment"] },
  { section: "Automation", modules: ["jobs-workflows", "webhook-delivery"] },
  { section: "Workspace", modules: ["file-media"] }
];

function itemsFor(moduleIds: string[], enabled: Set<string>): NavItem[] {
  return moduleIds.filter((id) => enabled.has(id) && MODULE_NAV[id]).map((id) => MODULE_NAV[id]);
}

// Build the grouped sidebar from the ENABLED module set. Overview (Dashboard +
// Agent Center + Notifications inbox) is always first; Settings always sits in
// Workspace; Admin only for super-admins. Empty groups are dropped.
export function buildNav(opts: { superAdmin?: boolean; platform?: App.Platform } = {}): NavGroup[] {
  const enabled = enabledModuleIds(opts.platform);
  const groups: NavGroup[] = [];

  groups.push({
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/app", icon: "dashboard" },
      { label: "Agent Center", href: "/app/agent", icon: "bot" },
      ...itemsFor(["notifications-inapp"], enabled)
    ]
  });

  for (const group of GROUPS) {
    const items = itemsFor(group.modules, enabled);
    // Settings (the config hub) always lives in Workspace, even if Files is off.
    if (group.section === "Workspace") {
      items.push({ label: "Settings", href: "/app/settings", icon: "settings" });
    }
    if (items.length > 0) groups.push({ section: group.section, items });
  }

  if (opts.superAdmin) {
    groups.push({ section: "System", items: [{ label: "Admin console", href: "/admin", icon: "shield" }] });
  }

  return groups.filter((g) => g.items.length > 0);
}
