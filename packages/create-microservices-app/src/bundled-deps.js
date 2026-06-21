// Single source of truth for which workspace modules/packages the scaffolder
// vendors into a generated app. index.js rewrites these deps to file: paths so a
// generated app is standalone; the closure test (tests/template-bundle-closure.
// test.mjs) asserts every template's @microservices-sh dependency (transitively)
// is covered here — so a template can never reference a workspace package the
// scaffolder won't bundle, which is what breaks `pnpm install` in the standalone
// app (the failure CI only catches for the one template it scaffolds).

export const BUNDLED_MODULES = [
  "admin-shell",
  "ads-manager",
  "audit-log",
  "auth",
  "billing-subscriptions",
  "booking",
  "calendar-google",
  "customer",
  "email",
  "file-media",
  "forms-intake",
  "gateway",
  "identity",
  "image-generation",
  "invoice",
  "jobs-workflows",
  "marketing-research",
  "notifications-inapp",
  "operator-work",
  "org-team-rbac",
  "payment",
  "research",
  "support-ticket",
  "webhook-delivery",
];

export const BUNDLED_PACKAGES = new Map([
  ["@microservices-sh/connection-contract", "connection-contract"],
  // ops-token's codec (mint/verify) is vendored like connection-contract so the
  // generated operate-app can verify ops tokens; it's pulled in transitively by
  // the research module (booking's /ops read-back route). See plan 32.
  ["@microservices-sh/ops-token", "ops-token"],
]);

// Published @microservices-sh packages a generated app may resolve from npm
// directly (so they don't need vendoring). Kept here so the closure test allows
// them. sdk-internal/module-contract are also esbuild-aliased into the CLI bundle.
export const PUBLISHED_ALLOWLIST = ["@microservices-sh/sdk-internal", "@microservices-sh/module-contract"];

// Per-scaffoldable-template manifest: which module/package SOURCE gets copied into
// the bundle (consumed by scripts/build.js). This is the "copied" half; BUNDLED_*
// above is the "rewritten to file:" half. They must agree — a dep rewritten to
// file:./modules/<x> whose source isn't copied points at a missing dir. The
// closure test asserts each template's dependency closure is covered by BOTH.
export const REPO_TEMPLATES = [
  "booking-sveltekit",
  "company-landing-astro",
  "wordpress-emdash-blog-astro",
  "saas-starter-sveltekit",
  "client-portal-sveltekit",
  "dot-ai-os",
  "erp-shell-sveltekit",
];

export const REPO_TEMPLATE_MODULES = {
  "booking-sveltekit": ["gateway", "auth", "customer", "booking", "audit-log", "email", "payment", "identity", "research"],
  "company-landing-astro": [],
  "wordpress-emdash-blog-astro": [],
  "saas-starter-sveltekit": ["auth", "identity", "email", "gateway", "org-team-rbac", "billing-subscriptions", "admin-shell", "audit-log", "payment"],
  "client-portal-sveltekit": ["auth", "identity", "email", "gateway", "customer", "invoice", "file-media", "audit-log"],
  "dot-ai-os": ["auth", "identity", "email", "gateway", "org-team-rbac", "admin-shell", "audit-log", "customer", "invoice", "file-media", "jobs-workflows", "notifications-inapp", "operator-work", "support-ticket"],
  "erp-shell-sveltekit": ["auth", "identity", "email", "gateway", "org-team-rbac", "admin-shell", "audit-log", "customer", "invoice", "payment", "billing-subscriptions", "image-generation", "ads-manager", "forms-intake", "booking", "file-media", "jobs-workflows", "notifications-inapp", "support-ticket", "webhook-delivery"],
};

export const REPO_TEMPLATE_PACKAGES = {
  "booking-sveltekit": ["connection-contract", "ops-token"],
  "company-landing-astro": [],
  "wordpress-emdash-blog-astro": [],
  "saas-starter-sveltekit": ["connection-contract"],
  "client-portal-sveltekit": ["connection-contract"],
  "dot-ai-os": ["connection-contract"],
  "erp-shell-sveltekit": ["connection-contract"],
};
