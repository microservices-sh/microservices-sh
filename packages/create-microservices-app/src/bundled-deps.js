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
