import { loadFrameworks } from "./framework-starter.js";

// Repo-style templates bundled into the package (see scripts/build.js). These
// are copied verbatim instead of generated procedurally from module-contract.
export const REPO_TEMPLATES = {
  "booking-sveltekit": {
    id: "booking-sveltekit",
    name: "Booking SvelteKit",
    status: "ready",
    visibility: "public",
    distribution: "bundled",
    category: "booking",
    weight: "heavy",
    summary: "Full Cloudflare SvelteKit booking app - public booking flow, admin, D1, typed hooks.",
  },
  "company-landing-astro": {
    id: "company-landing-astro",
    name: "Company Landing (Astro)",
    status: "ready",
    visibility: "public",
    distribution: "bundled",
    category: "website",
    weight: "light",
    summary: "Static editorial company landing page on Astro - refined light design, content-driven, no backend modules.",
  },
  "wordpress-emdash-blog-astro": {
    id: "wordpress-emdash-blog-astro",
    name: "WordPress to EmDash Blog (Astro)",
    status: "experimental",
    visibility: "public",
    distribution: "bundled",
    category: "website",
    weight: "light",
    summary: "Cloudflare Astro + EmDash template for content-only WordPress blog migrations with D1/R2 and source probing.",
  },
  "saas-starter-sveltekit": {
    id: "saas-starter-sveltekit",
    name: "SaaS Starter SvelteKit",
    status: "ready",
    visibility: "public",
    distribution: "bundled",
    category: "saas",
    weight: "heavy",
    summary: "Multi-tenant B2B SaaS starter on Cloudflare SvelteKit - org sign-up, team RBAC, subscriptions, admin, audit log.",
  },
  "client-portal-sveltekit": {
    id: "client-portal-sveltekit",
    name: "Client Portal SvelteKit",
    status: "ready",
    visibility: "public",
    distribution: "bundled",
    category: "portal",
    weight: "standard",
    summary: "Cloudflare SvelteKit client portal - customers see their own invoices and files, with auth, customer, and audit-log.",
  },
  "dot-ai-os": {
    id: "dot-ai-os",
    name: "DOT AI OS",
    status: "private-pilot",
    visibility: "private",
    distribution: "bundled",
    category: "ai-os",
    weight: "heavy",
    summary: "Private-pilot operator workspace on Cloudflare SvelteKit - workflows, knowledge, decisions, files, team roles, and module-backed work surfaces.",
  },
  "erp-shell-sveltekit": {
    id: "erp-shell-sveltekit",
    name: "ERP Shell SvelteKit",
    status: "ready",
    visibility: "public",
    distribution: "bundled",
    category: "erp",
    weight: "heavy",
    summary: "Cloudflare SvelteKit ERP shell - customers, invoices, files, support tickets, teams, admin, and audit log.",
  },
};

export const PRIVATE_REPO_TEMPLATE_IDS = new Set(
  Object.values(REPO_TEMPLATES)
    .filter((template) => template.visibility === "private" || template.status === "private-pilot")
    .map((template) => template.id)
);

function normalizeTemplate(template, defaults) {
  return {
    visibility: "public",
    distribution: "registry",
    category: "general",
    weight: "light",
    ...defaults,
    ...template,
  };
}

function isPrivateCatalogTemplate(template) {
  return template.visibility === "private" || template.status === "private-pilot" || template.distribution === "private";
}

export function availableTemplateList({ includePrivate = false, proceduralTemplates = [] } = {}) {
  const procedural = (Array.isArray(proceduralTemplates) ? proceduralTemplates : []).map((template) =>
    normalizeTemplate(template, { distribution: "registry", category: "procedural", weight: "light" })
  );
  const repo = Object.values(REPO_TEMPLATES).map((template) => normalizeTemplate(template, { distribution: "bundled" }));
  const seen = new Set(procedural.map((template) => template.id));
  const base = [...procedural, ...repo.filter((template) => !seen.has(template.id))].filter(
    (template) => includePrivate || !isPrivateCatalogTemplate(template)
  );
  const frameworks = loadFrameworks().map((row) => ({
    id: row.id,
    name: `${row.label} (Cloudflare starter)`,
    status: row.status,
    visibility: "public",
    distribution: "registry",
    category: "framework",
    weight: "light",
    summary: `${row.label} on Cloudflare Workers - empty starter, add modules via microservices.sh.`,
  }));
  const baseIds = new Set(base.map((template) => template.id));
  return [...base, ...frameworks.filter((framework) => !baseIds.has(framework.id))];
}

export function filterTemplateList(templates, { category = null, search = null } = {}) {
  const normalizedCategory = String(category ?? "").trim().toLowerCase();
  const normalizedSearch = String(search ?? "").trim().toLowerCase();

  return templates.filter((template) => {
    if (normalizedCategory && String(template.category ?? "").toLowerCase() !== normalizedCategory) return false;
    if (!normalizedSearch) return true;
    const haystack = [
      template.id,
      template.name,
      template.status,
      template.visibility,
      template.distribution,
      template.category,
      template.weight,
      template.summary,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

export function orderedTemplateList(defaultTemplateId, options) {
  const templates = filterTemplateList(availableTemplateList(options), options);
  const defaultIndex = templates.findIndex((template) => template.id === defaultTemplateId);
  if (defaultIndex <= 0) return templates;
  return [templates[defaultIndex], ...templates.slice(0, defaultIndex), ...templates.slice(defaultIndex + 1)];
}

export function isPrivateTemplate(templateId) {
  return PRIVATE_REPO_TEMPLATE_IDS.has(templateId);
}
