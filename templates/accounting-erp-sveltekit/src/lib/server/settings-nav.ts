import { enabledModuleIds } from "./modules";

// ── Settings hub sub-nav ────────────────────────────────────────────────────
//
// Configuration is centralized under /app/settings (a sub-area with its own
// grouped nav), mirroring the merchant-portal pattern: operational feature pages
// stay clean, and every "set it up" surface lives here. Each item is optionally
// gated by a module id — a section/item only shows when its module is enabled.

export interface SettingsNavItem {
  href: string;
  label: string;
}
export interface SettingsNavGroup {
  section: string;
  items: SettingsNavItem[];
}

const SECTIONS: { section: string; items: { label: string; href: string; module?: string }[] }[] = [
  {
    section: "Workspace",
    items: [
      { label: "Organization", href: "/app/settings" },
      { label: "Team", href: "/app/settings/team", module: "org-team-rbac" }
    ]
  },
  {
    section: "Integrations",
    items: [{ label: "Webhook endpoints", href: "/app/settings/webhooks", module: "webhook-delivery" }]
  },
  {
    section: "Automation",
    items: [{ label: "Job schedules", href: "/app/settings/schedules", module: "jobs-workflows" }]
  }
];

export function buildSettingsNav(platform?: App.Platform): SettingsNavGroup[] {
  const enabled = enabledModuleIds(platform);
  return SECTIONS.map((s) => ({
    section: s.section,
    items: s.items.filter((i) => !i.module || enabled.has(i.module))
  })).filter((g) => g.items.length > 0);
}
