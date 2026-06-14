import {
  composeApp as composeContractApp,
  inspectModule as inspectContractModule,
  inspectTemplate as inspectContractTemplate,
  listModules as listContractModules,
  listTemplates as listContractTemplates,
} from "@microservices-sh/module-contract";

function requestId() {
  return `local_${Date.now().toString(36)}`;
}

function ok(data, warnings = []) {
  return {
    ok: true,
    requestId: requestId(),
    data,
    warnings,
  };
}

function fail(error) {
  return {
    ok: false,
    requestId: requestId(),
    error: {
      code: error.code ?? "UNKNOWN_ERROR",
      message: error.message,
      remediation: error.remediation ?? "Inspect the command input and retry.",
      details: error.details ?? {},
    },
  };
}

function capture(fn) {
  try {
    return ok(fn());
  } catch (error) {
    return fail(error);
  }
}

function slugify(value) {
  return String(value ?? "microservices-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "microservices-app";
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const PLANNED_MODULE_DOCS = Object.freeze([
  {
    id: "payment-stripe",
    name: "Stripe Payment",
    version: "0.1.0",
    status: "planned",
    class: "provider",
    mount: "/payments",
    summary:
      "Full Stripe payment workflow: products, prices, checkout, payment links, webhooks, refunds, and payment events.",
    requires: ["auth", "customer"],
    permissions: ["payment.read", "payment.write", "payment.admin"],
    approvalRisk: "high",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    resources: ["D1 payment tables", "Stripe webhook endpoint", "outbound fetch to api.stripe.com"],
    hooks: ["beforeCheckoutCreate", "afterPaymentSucceeded", "beforeRefundCreate"],
    events: ["payment.checkout_created", "payment.succeeded", "payment.refunded", "payment.failed"],
    statusNote: "Planned provider module. MVP command should produce an install plan before code mutation.",
  },
  {
    id: "email",
    name: "Email",
    version: "0.1.0",
    status: "planned",
    class: "provider-capable core",
    mount: "/emails",
    summary: "Transactional email templates, provider adapters, delivery jobs, and delivery events.",
    requires: [],
    permissions: ["email.read", "email.write", "email.admin"],
    approvalRisk: "high",
    secrets: ["EMAIL_PROVIDER_API_KEY"],
    resources: ["Queue for delivery jobs", "outbound fetch to provider API"],
    hooks: ["renderEmailTemplate", "beforeEmailSend", "afterEmailDelivered"],
    events: ["email.queued", "email.sent", "email.failed"],
    statusNote: "Planned provider-capable module. Start with test mode and approval-gated sends.",
  },
  {
    id: "audit-log",
    name: "Audit Log",
    version: "0.1.0",
    status: "planned",
    class: "core",
    mount: "/audit",
    summary: "Mutation audit trail and domain event recording with actor, action, resource, request id, and metadata.",
    requires: [],
    permissions: ["audit.read", "audit.export", "audit.admin"],
    approvalRisk: "medium",
    secrets: [],
    resources: ["D1 audit_events table", "optional R2 export bucket"],
    hooks: ["redactAuditPayload", "beforeAuditExport"],
    events: ["audit.recorded", "audit.exported"],
    statusNote: "Partly present in generated apps as src/lib/audit.ts; full module packaging is planned.",
  },
]);

function docPathFor(moduleId) {
  return `docs/modules/${moduleId}.md`;
}

function availableModuleDocs() {
  return listContractModules().map((summary) => {
    const module = inspectContractModule(summary.id);
    return {
      id: module.id,
      name: module.name,
      version: module.version,
      status: module.status,
      class: module.category,
      mount: module.runtime.mount,
      docPath: docPathFor(module.id),
      summary: module.summary,
      requires: module.requires,
      permissions: module.permissions,
      approvalRisk: module.id === "auth" ? "high" : "medium",
      secrets: module.id === "auth" ? ["SESSION_SECRET"] : [],
      resources: module.storage.map((item) => item.toUpperCase()),
      hooks: module.hooks.map((hook) => hook.name),
      events: [...module.eventsEmitted, ...module.eventsConsumed],
      statusNote: "Available in the generated MVP app.",
    };
  });
}

function moduleCatalog() {
  const modules = [...availableModuleDocs(), ...PLANNED_MODULE_DOCS].map((module) => ({
    id: module.id,
    name: module.name,
    version: module.version,
    status: module.status,
    class: module.class,
    mount: module.mount,
    docPath: module.docPath ?? docPathFor(module.id),
    summary: module.summary,
    requires: module.requires,
    permissions: module.permissions,
    approvalRisk: module.approvalRisk,
    secrets: module.secrets,
    resources: module.resources,
    hooks: module.hooks,
    events: module.events,
  }));

  return {
    schemaVersion: "2026-06-13",
    description:
      "Compact LLM-readable catalog for generated microservices.sh projects. Read the referenced Markdown docs before modifying modules.",
    agentGuidance: {
      preferDocsBeforeCodeChanges: true,
      neverExposeSecretValues: true,
      defaultCustomizationOrder: ["config", "hooks", "overlays", "fork"],
      approvalGatedCategories: ["auth", "payment", "email", "pii", "webhook", "migration", "production_deploy", "delete"],
      sourceOwnershipDefault: "user-owned repository with branch/PR or patch workflow",
    },
    modules,
  };
}

function findCatalogModule(moduleId) {
  const module = moduleCatalog().modules.find((candidate) => candidate.id === moduleId);
  if (!module) {
    const error = new Error(`Unknown module: ${moduleId}`);
    error.code = "MODULE_NOT_FOUND";
    error.remediation = "Run modules list --json and select a returned module id.";
    error.details = { moduleId };
    throw error;
  }
  return module;
}

function moduleDocMarkdown(module) {
  return `# ${module.name}

Status: ${module.status}
Module ID: \`${module.id}\`
Mount: \`${module.mount}\`

## Summary
${module.summary}

## Dependencies
${module.requires.length ? module.requires.map((item) => `- ${item}`).join("\n") : "- none"}

## Permissions
${module.permissions.map((item) => `- ${item}`).join("\n")}

## Secrets
${module.secrets.length ? module.secrets.map((item) => `- ${item}`).join("\n") : "- none"}

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
${module.resources.length ? module.resources.map((item) => `- ${item}`).join("\n") : "- none"}

## Hooks
${module.hooks.length ? module.hooks.map((item) => `- ${item}`).join("\n") : "- none"}

## Events
${module.events.length ? module.events.map((item) => `- ${item}`).join("\n") : "- none"}

## Approval Gate
Risk: ${module.approvalRisk}

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
`;
}

function buildLlmGuide(composition) {
  return `# ${composition.config.appName ?? composition.template.name} Agent Guide

This project was generated by microservices.sh.

## First Commands
\`\`\`bash
pnpm install
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm dev
\`\`\`

## Agent Rules
1. Read \`microservices.lock.json\` before changing modules.
2. Read \`docs/modules/catalog.json\` and the relevant module docs before edits.
3. Prefer config and hooks before editing module internals.
4. Never ask the user to paste secret values into chat.
5. Treat payment, email, auth, PII, webhooks, migrations, and production deploys as approval-gated.
6. Run \`pnpm microservices check --json\` before preview or production deployment.
7. Run \`pnpm microservices upgrade <module-id> --plan --json\` before changing locked module versions.

## Current Modules
${composition.modules.map((module) => `- ${module.id}@${module.version} at ${module.runtime.mount}`).join("\n")}
`;
}

function buildMicroservicesConfig(composition) {
  return json({
    schemaVersion: "2026-06-13",
    template: composition.template.id,
    runtime: {
      framework: "hono",
      platform: "cloudflare-workers",
    },
    moduleDocs: "docs/modules/catalog.json",
    lockfile: "microservices.lock.json",
    managedCloudflare: {
      dispatchNamespace: "microservices-sh",
      previewDeploy: "approval-gated",
    },
  });
}

function buildPackageJson(composition) {
  const appSlug = slugify(composition.config.appSlug ?? composition.config.appName);
  return json({
    name: appSlug,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "wrangler dev",
      deploy: "wrangler deploy",
      "db:init": "wrangler d1 execute microservices_generated --local --file=./schema.sql",
      microservices: "node scripts/microservices.js",
      ms: "node scripts/microservices.js",
      check: "node scripts/microservices.js check && tsc --noEmit",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      hono: "^4.6.14",
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20241218.0",
      typescript: "^5.9.3",
      wrangler: "^3.95.0",
    },
  });
}

function buildWranglerJson(composition) {
  const appSlug = slugify(composition.config.appSlug ?? composition.config.appName);
  return json({
    $schema: "node_modules/wrangler/config-schema.json",
    name: appSlug,
    main: "src/index.ts",
    compatibility_date: "2026-06-01",
    compatibility_flags: ["nodejs_compat"],
    observability: { enabled: true },
    d1_databases: [
      {
        binding: "DB",
        database_name: "microservices_generated",
        database_id: "REPLACE_WITH_D1_ID",
      },
    ],
    kv_namespaces: [
      {
        binding: "CACHE_KV",
        id: "REPLACE_WITH_KV_ID",
      },
    ],
  });
}

function buildSchemaSql() {
  return `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  actor_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_name ON domain_events(event_name);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
`;
}

function buildTsConfig() {
  return json({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      lib: ["ES2022"],
      types: ["@cloudflare/workers-types"],
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["src/**/*.ts"],
  });
}

function buildEnvTs() {
  return `export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  NOTIFICATIONS?: Queue;
}
`;
}

function buildAuditTs() {
  return `import type { Env } from "./env";

export interface AuditPayload {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  payload?: unknown;
}

export async function writeAudit(env: Env, eventName: string, input: AuditPayload = {}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO audit_events (id, event_name, actor_id, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      eventName,
      input.actorId ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify(input.payload ?? {}),
      now
    )
    .run();

  return { id, eventName, createdAt: now };
}

export async function emitDomainEvent(
  env: Env,
  eventName: string,
  entityType: string,
  entityId: string,
  payload: unknown = {}
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, eventName, entityType, entityId, JSON.stringify(payload), now)
    .run();

  return { id, eventName, createdAt: now };
}
`;
}

function buildHooksTs(composition) {
  return `export interface HookResult<T = unknown> {
  ok: boolean;
  value?: T;
  warnings?: string[];
}

export interface BookingDraft {
  customerId: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
  metadata?: Record<string, unknown>;
}

export const hookConfig = ${JSON.stringify(composition.config, null, 2)} as const;

export async function beforeSignup(input: { email: string; role: string }): Promise<HookResult<typeof input>> {
  return { ok: true, value: input };
}

export async function beforeCustomerCreate<T extends Record<string, unknown>>(input: T): Promise<HookResult<T>> {
  return { ok: true, value: input };
}

export async function beforeBookingCreate(input: BookingDraft): Promise<HookResult<BookingDraft>> {
  return { ok: true, value: input };
}

export async function calculateAvailability(
  input: { serviceType: string; from: string; to: string }
): Promise<HookResult<{ serviceType: string; slots: unknown[]; generatedBy: string }>> {
  return {
    ok: true,
    value: {
      serviceType: input.serviceType,
      slots: [],
      generatedBy: "microservices.sh hook placeholder",
    },
  };
}

export async function afterBookingConfirmed(input: { bookingId: string; customerId: string }) {
  return { ok: true, value: input };
}
`;
}

function buildIndexTs(composition) {
  const routeImports = composition.modules
    .map((module) => `import { ${module.id.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}Routes } from "./modules/${module.id}";`)
    .join("\n");
  const routeMounts = composition.modules
    .map((module) => `app.route("${module.runtime.mount}", ${module.id.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}Routes);`)
    .join("\n");

  return `import { Hono } from "hono";
import type { Env } from "./lib/env";
${routeImports}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
  c.json({
    ok: true,
    app: ${JSON.stringify(composition.config.appName ?? composition.template.name)},
    template: ${JSON.stringify(composition.template.id)},
    modules: ${JSON.stringify(composition.modules.map((module) => module.id))},
  })
);

${routeMounts}

export default app;
`;
}

function buildAuthModuleTs() {
  return `import { Hono } from "hono";
import type { Env } from "../lib/env";
import { emitDomainEvent, writeAudit } from "../lib/audit";
import { beforeSignup } from "../lib/hooks";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/signup", async (c) => {
  const body = (await c.req.json<{ email?: string; role?: string }>().catch(() => ({}))) as {
    email?: string;
    role?: string;
  };
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "member").trim() || "member";

  if (!email.includes("@")) {
    return c.json({ ok: false, error: "A valid email is required." }, 400);
  }

  const hook = await beforeSignup({ email, role });
  if (!hook.ok || !hook.value) {
    return c.json({ ok: false, error: "Signup rejected by beforeSignup hook.", warnings: hook.warnings ?? [] }, 422);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare("INSERT INTO users (id, email, role, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, hook.value.email, hook.value.role, now)
    .run();

  await emitDomainEvent(c.env, "auth.user_created", "user", id, { email: hook.value.email, role: hook.value.role });
  await writeAudit(c.env, "auth.user_created", {
    actorId: id,
    entityType: "user",
    entityId: id,
    payload: { email: hook.value.email, role: hook.value.role },
  });

  return c.json({ ok: true, user: { id, email: hook.value.email, role: hook.value.role } }, 201);
});
`;
}

function buildCustomerModuleTs() {
  return `import { Hono } from "hono";
import type { Env } from "../lib/env";
import { emitDomainEvent, writeAudit } from "../lib/audit";
import { beforeCustomerCreate } from "../lib/hooks";

export const customerRoutes = new Hono<{ Bindings: Env }>();

customerRoutes.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, user_id, name, email, phone, notes, tags, created_at, updated_at FROM customers ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json({ ok: true, customers: rows.results ?? [] });
});

customerRoutes.post("/", async (c) => {
  const body = (await c.req.json<Record<string, unknown>>().catch(() => ({}))) as Record<string, unknown>;
  const draft = await beforeCustomerCreate({
    userId: typeof body.userId === "string" ? body.userId : null,
    name: String(body.name ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(),
    phone: typeof body.phone === "string" ? body.phone : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    tags: Array.isArray(body.tags) ? body.tags : [],
  });

  if (!draft.ok || !draft.value?.name || !String(draft.value.email).includes("@")) {
    return c.json({ ok: false, error: "Customer name and valid email are required.", warnings: draft.warnings ?? [] }, 400);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO customers (id, user_id, name, email, phone, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      draft.value.userId,
      draft.value.name,
      draft.value.email,
      draft.value.phone,
      draft.value.notes,
      JSON.stringify(draft.value.tags),
      now,
      now
    )
    .run();

  await emitDomainEvent(c.env, "customer.created", "customer", id, draft.value);
  await writeAudit(c.env, "customer.created", {
    entityType: "customer",
    entityId: id,
    payload: draft.value,
  });

  return c.json({ ok: true, customer: { id, ...draft.value } }, 201);
});
`;
}

function buildBookingModuleTs() {
  return `import { Hono } from "hono";
import type { Env } from "../lib/env";
import { emitDomainEvent, writeAudit } from "../lib/audit";
import { afterBookingConfirmed, beforeBookingCreate, calculateAvailability } from "../lib/hooks";

export const bookingRoutes = new Hono<{ Bindings: Env }>();

bookingRoutes.get("/availability", async (c) => {
  const serviceType = c.req.query("serviceType") ?? "standard-service";
  const from = c.req.query("from") ?? new Date().toISOString();
  const to = c.req.query("to") ?? from;
  const availability = await calculateAvailability({ serviceType, from, to });
  return c.json({ ok: true, availability: availability.value, warnings: availability.warnings ?? [] });
});

bookingRoutes.post("/", async (c) => {
  const body = (await c.req.json<Record<string, unknown>>().catch(() => ({}))) as Record<string, unknown>;
  const draft = await beforeBookingCreate({
    customerId: String(body.customerId ?? ""),
    serviceType: String(body.serviceType ?? "standard-service"),
    startsAt: String(body.startsAt ?? ""),
    endsAt: String(body.endsAt ?? ""),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {},
  });

  if (!draft.ok || !draft.value?.customerId || !draft.value.startsAt || !draft.value.endsAt) {
    return c.json({ ok: false, error: "customerId, startsAt, and endsAt are required.", warnings: draft.warnings ?? [] }, 400);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO bookings (id, customer_id, service_type, status, starts_at, ends_at, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      draft.value.customerId,
      draft.value.serviceType,
      "confirmed",
      draft.value.startsAt,
      draft.value.endsAt,
      JSON.stringify(draft.value.metadata ?? {}),
      now,
      now
    )
    .run();

  await afterBookingConfirmed({ bookingId: id, customerId: draft.value.customerId });
  await emitDomainEvent(c.env, "booking.confirmed", "booking", id, draft.value);
  await writeAudit(c.env, "booking.confirmed", {
    entityType: "booking",
    entityId: id,
    payload: draft.value,
  });

  return c.json({ ok: true, booking: { id, status: "confirmed", ...draft.value } }, 201);
});
`;
}

function buildAgentReadme(composition) {
  const moduleList = composition.modules.map((module) => `- ${module.name} (${module.id}) at ${module.runtime.mount}`).join("\n");
  const hookList = composition.hooks.map((hook) => `- ${hook.name}: ${hook.purpose}`).join("\n");

  return `# ${composition.config.appName ?? composition.template.name}

Generated by microservices.sh local MVP tooling.

## Modules
${moduleList}

## Safe Customization
Use configuration and hooks before editing module route internals.

Hooks live in \`src/lib/hooks.ts\`:
${hookList}

## Audit And Events
Domain events are written to \`domain_events\`.
Audit events are written to \`audit_events\`.
Every generated mutation should emit both a domain event and an audit event.

## Local Commands
\`\`\`bash
pnpm install
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm db:init
pnpm dev
\`\`\`

Use \`pnpm microservices add <module-id> --plan --json\` before installing planned provider modules.
Use \`pnpm microservices upgrade <module-id> --plan --json\` before updating a locked module.

## Deploy
Create D1/KV resources, replace IDs in \`wrangler.jsonc\`, then run:

\`\`\`bash
pnpm deploy
\`\`\`
`;
}

function buildProjectCliJs() {
  const script = `#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = [];
  const flags = { json: false, plan: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") flags.json = true;
    else if (value === "--plan") flags.plan = true;
    else args.push(value);
  }
  return { args, flags };
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function catalog() {
  return readJson("docs/modules/catalog.json", { modules: [] });
}

function lockfile() {
  return readJson("microservices.lock.json", { modules: [] });
}

function ok(data, warnings = []) {
  return { ok: true, data, warnings };
}

function fail(message, remediation, details = {}) {
  return { ok: false, error: { message, remediation, details } };
}

function writeJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\\n");
}

function findModule(id) {
  return catalog().modules.find((module) => module.id === id);
}

function modulePlan(id) {
  const module = findModule(id);
  if (!module) {
    return fail("Unknown module.", "Run pnpm microservices modules list --json and pick a returned id.", { id });
  }
  const lock = lockfile();
  const installed = new Set((lock.modules ?? []).map((item) => item.id));
  const missingDependencies = (module.requires ?? []).filter((item) => !installed.has(item));
  const alreadyInstalled = installed.has(module.id);
  const gated = module.approvalRisk === "high" || (module.secrets ?? []).length > 0 || module.status !== "available";

  return ok({
    module,
    action: alreadyInstalled ? "already-installed" : module.status === "available" ? "install" : "planned-install",
    alreadyInstalled,
    missingDependencies,
    approvalRequired: gated,
    requiredSecrets: module.secrets ?? [],
    requiredResources: module.resources ?? [],
    requiredPermissions: module.permissions ?? [],
    filesLikelyTouched: [
      "microservices.lock.json",
      "wrangler.jsonc",
      "schema.sql",
      "src/index.ts",
      "src/modules/" + module.id + ".ts",
      "docs/modules/" + module.id + ".md",
    ],
    nextSteps: [
      "Review this plan with the user.",
      "Confirm gated side effects before changing secrets, resources, webhooks, migrations, or deploy settings.",
      "Apply generated code changes only after approval.",
      "Run pnpm microservices check --json and pnpm typecheck after changes.",
    ],
  }, module.status === "planned" ? ["Module is planned; this command produces a plan only."] : []);
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function stringDiff(fromValues, toValues, hasSnapshot) {
  const from = hasSnapshot ? new Set(asStringArray(fromValues)) : new Set();
  const to = new Set(asStringArray(toValues));
  return {
    added: hasSnapshot ? Array.from(to).filter((item) => !from.has(item)) : [],
    removed: hasSnapshot ? Array.from(from).filter((item) => !to.has(item)) : [],
    unchanged: Array.from(to).filter((item) => from.has(item)),
    snapshotAvailable: hasSnapshot,
  };
}

function customizationMatches(value, moduleId) {
  if (typeof value === "string") return value === moduleId || value.startsWith(moduleId + ":") || value.startsWith(moduleId + "/");
  if (value && typeof value === "object") {
    return value.module === moduleId || value.moduleId === moduleId || value.id === moduleId;
  }
  return false;
}

function matchingCustomizations(items, moduleId) {
  return Array.isArray(items) ? items.filter((item) => customizationMatches(item, moduleId)) : [];
}

function targetContract(module) {
  return {
    mount: module.mount,
    resources: module.resources ?? [],
    permissions: module.permissions ?? [],
    hooks: module.hooks ?? [],
    events: module.events ?? [],
    requires: module.requires ?? [],
    secrets: module.secrets ?? [],
  };
}

function filesForUpgrade(module, diff) {
  const files = new Set(["microservices.lock.json", "docs/modules/" + module.id + ".md"]);
  if (module.status === "available") files.add("src/modules/" + module.id + ".ts");
  if (diff.resources.added.length || diff.resources.removed.length || (module.secrets ?? []).length) files.add("wrangler.jsonc");
  if ((module.resources ?? []).some((resource) => String(resource).toLowerCase().includes("d1"))) files.add("schema.sql");
  if (diff.hooks.added.length || diff.hooks.removed.length || (module.hooks ?? []).length) files.add("src/lib/hooks.ts");
  return Array.from(files);
}

function upgradePlan(id) {
  const module = findModule(id);
  if (!module) {
    return fail("Unknown module.", "Run pnpm microservices modules list --json and pick a returned id.", { id });
  }

  const lock = lockfile();
  const locked = (lock.modules ?? []).find((item) => item.id === id);
  if (!locked) {
    return fail("Module is not installed.", "Run pnpm microservices modules list --json, then plan an upgrade for an installed module.", { id });
  }

  const hasSnapshot = Boolean(locked.contract && typeof locked.contract === "object");
  const currentContract = locked.contract ?? {};
  const nextContract = targetContract(module);
  const upgradeAvailable = locked.version !== module.version;
  const diff = {
    mount: hasSnapshot && currentContract.mount !== nextContract.mount
      ? { from: currentContract.mount ?? null, to: nextContract.mount }
      : { from: currentContract.mount ?? nextContract.mount, to: nextContract.mount },
    resources: stringDiff(currentContract.resources, nextContract.resources, hasSnapshot),
    permissions: stringDiff(currentContract.permissions, nextContract.permissions, hasSnapshot),
    hooks: stringDiff(currentContract.hooks, nextContract.hooks, hasSnapshot),
    events: stringDiff(currentContract.events, nextContract.events, hasSnapshot),
    requires: stringDiff(currentContract.requires, nextContract.requires, hasSnapshot),
    secrets: {
      added: upgradeAvailable ? nextContract.secrets : [],
      removed: [],
      unchanged: upgradeAvailable ? [] : nextContract.secrets,
      snapshotAvailable: false,
    },
  };
  const customizations = lock.customizations ?? {};
  const customizationImpact = {
    configPreserved: customizations.config !== false,
    hooksToReview: module.hooks ?? [],
    overlaysToReview: matchingCustomizations(customizations.overlays, module.id),
    forksToReview: matchingCustomizations(customizations.forks, module.id),
  };
  const hasForks = customizationImpact.forksToReview.length > 0;
  const hasOverlays = customizationImpact.overlaysToReview.length > 0;
  const changesResources = diff.resources.added.length > 0 || diff.resources.removed.length > 0;
  const changesPermissions = diff.permissions.added.length > 0 || diff.permissions.removed.length > 0;
  const changesSecrets = diff.secrets.added.length > 0 || diff.secrets.removed.length > 0;
  const approvalRequired = upgradeAvailable && (
    module.approvalRisk === "high" || changesSecrets || changesResources || changesPermissions || hasForks || hasOverlays
  );
  const risk = !upgradeAvailable
    ? "low"
    : approvalRequired || hasForks
      ? "high"
      : hasOverlays || diff.hooks.added.length || diff.hooks.removed.length
        ? "medium"
        : "low";

  return ok({
    module: {
      id: module.id,
      name: module.name,
      status: module.status,
      currentVersion: locked.version,
      targetVersion: module.version,
    },
    action: upgradeAvailable ? "upgrade-plan" : "no-op",
    upgradeAvailable,
    approvalRequired,
    risk,
    lockfile: {
      schemaVersion: lock.schemaVersion ?? null,
      registryVersion: catalog().schemaVersion ?? null,
      template: lock.template ?? null,
      source: locked.source ?? null,
      checksum: locked.checksum ?? null,
      contractSnapshotAvailable: hasSnapshot,
    },
    diff,
    customizationImpact,
    filesLikelyTouched: upgradeAvailable ? filesForUpgrade(module, diff) : [],
    permissionGate: {
      required: approvalRequired,
      reasons: [
        module.approvalRisk === "high" ? "high-risk module" : null,
        changesSecrets ? "secret changes" : null,
        changesResources ? "resource changes" : null,
        changesPermissions ? "permission changes" : null,
        hasOverlays ? "overlay customizations require merge review" : null,
        hasForks ? "forked module requires manual merge review" : null,
      ].filter(Boolean),
    },
    nextSteps: upgradeAvailable
      ? [
          "Review this plan with the user before modifying source.",
          "Create a branch or patch for the upgrade.",
          "Review hook, overlay, and fork impacts before applying generated changes.",
          "Run pnpm microservices check --json and pnpm typecheck after applying.",
          "Deploy preview only after approval for resources, migrations, webhooks, or secrets.",
        ]
      : [
          "No upgrade is available from the current registry snapshot.",
          "Run microservices updates --json later to check again.",
        ],
  });
}

function updates() {
  const lock = lockfile();
  const modules = catalog().modules;
  const byId = new Map(modules.map((module) => [module.id, module]));
  const current = [];
  const unavailable = [];

  for (const locked of lock.modules ?? []) {
    const registryModule = byId.get(locked.id);
    if (!registryModule) {
      unavailable.push({ id: locked.id, currentVersion: locked.version, reason: "No matching catalog module." });
      continue;
    }
    current.push({
      id: locked.id,
      currentVersion: locked.version,
      latestVersion: registryModule.version,
      status: locked.version === registryModule.version ? "current" : "update-available",
    });
  }

  return ok({
    schemaVersion: lock.schemaVersion ?? null,
    registryVersion: catalog().schemaVersion ?? null,
    template: lock.template ?? null,
    current,
    available: current.filter((item) => item.status === "update-available"),
    unavailable,
    policy: lock.customizations ?? {
      config: true,
      hooks: [],
      overlays: [],
      forks: [],
    },
  });
}

function secretsStatus() {
  const installedIds = new Set((lockfile().modules ?? []).map((item) => item.id));
  const modules = catalog().modules.filter((module) => installedIds.has(module.id) || (module.secrets ?? []).length > 0);
  return ok({
    secrets: modules.flatMap((module) =>
      (module.secrets ?? []).map((name) => ({
        module: module.id,
        name,
        configured: false,
        scope: "project/env/module/" + module.id + "/" + name,
        valueVisibleToAgent: false,
      }))
    ),
  });
}

function checks() {
  const requiredFiles = [
    "package.json",
    "wrangler.jsonc",
    "schema.sql",
    "microservices.lock.json",
    "docs/llms.txt",
    "docs/modules/catalog.json",
    "src/index.ts",
    "src/lib/hooks.ts",
  ];
  const result = requiredFiles.map((path) => ({
    id: "file:" + path,
    status: existsSync(path) ? "pass" : "fail",
    message: existsSync(path) ? path + " exists." : path + " is missing.",
  }));
  return ok({
    status: result.every((item) => item.status === "pass") ? "pass" : "fail",
    checks: result,
  });
}

function usage() {
  return "microservices project CLI\\n\\n" +
    "Usage:\\n" +
    "  pnpm microservices modules list [--json]\\n" +
    "  pnpm microservices modules inspect <id> [--json]\\n" +
    "  pnpm microservices docs <id> [--json]\\n" +
    "  pnpm microservices add <id> --plan [--json]\\n" +
    "  pnpm microservices secrets status [--json]\\n" +
    "  pnpm microservices updates [--json]\\n" +
    "  pnpm microservices upgrade <id> --plan [--json]\\n" +
    "  pnpm microservices check [--json]\\n" +
    "  pnpm microservices dev\\n";
}

const { args, flags } = parseArgs(process.argv.slice(2));
const [resource, action, value] = args;
let response;

if (!resource || resource === "help" || resource === "--help" || resource === "-h") {
  process.stdout.write(usage());
} else if (resource === "modules" && action === "list") {
  response = ok(catalog().modules);
  flags.json ? writeJson(response) : process.stdout.write(response.data.map((module) => module.id + " (" + module.status + ") - " + module.summary).join("\\n") + "\\n");
} else if (resource === "modules" && action === "inspect") {
  const module = findModule(value);
  response = module ? ok(module) : fail("Unknown module.", "Run modules list --json and pick a returned id.", { id: value });
  flags.json ? writeJson(response) : process.stdout.write(response.ok ? module.name + "\\n" + module.summary + "\\nMount: " + module.mount + "\\nStatus: " + module.status + "\\n" : "Error: " + response.error.message + "\\n");
} else if (resource === "docs") {
  const module = findModule(action);
  if (!module) {
    response = fail("Unknown module.", "Run modules list --json and pick a returned id.", { id: action });
  } else if (!existsSync(module.docPath)) {
    response = fail("Module doc is missing.", "Regenerate the app or check docs/modules/catalog.json.", { path: module.docPath });
  } else {
    response = ok({ id: module.id, path: module.docPath, markdown: readFileSync(module.docPath, "utf8") });
  }
  flags.json ? writeJson(response) : process.stdout.write(response.ok ? response.data.markdown : "Error: " + response.error.message + "\\n");
} else if (resource === "add") {
  if (!flags.plan) {
    response = fail("Add requires --plan in the MVP scaffold.", "Run pnpm microservices add <module-id> --plan --json.", { id: action });
  } else {
    response = modulePlan(action);
  }
  flags.json ? writeJson(response) : process.stdout.write(response.ok ? "Plan for " + response.data.module.id + ": " + response.data.action + "\\nApproval required: " + response.data.approvalRequired + "\\n" : "Error: " + response.error.message + "\\n");
} else if (resource === "secrets" && action === "status") {
  response = secretsStatus();
  flags.json ? writeJson(response) : process.stdout.write((response.data.secrets.map((item) => item.module + ":" + item.name + " configured=" + item.configured).join("\\n") || "No required secrets for installed modules.") + "\\n");
} else if (resource === "updates") {
  response = updates();
  flags.json ? writeJson(response) : process.stdout.write((response.data.current.map((item) => item.id + ": " + item.currentVersion + " -> " + item.latestVersion + " (" + item.status + ")").join("\\n") || "No locked modules.") + "\\n");
} else if (resource === "upgrade") {
  if (!flags.plan) {
    response = fail("Upgrade requires --plan in the MVP scaffold.", "Run pnpm microservices upgrade <module-id> --plan --json.", { id: action });
  } else {
    response = upgradePlan(action);
  }
  flags.json ? writeJson(response) : process.stdout.write(response.ok ? "Upgrade plan for " + response.data.module.id + ": " + response.data.action + "\\nApproval required: " + response.data.approvalRequired + "\\nRisk: " + response.data.risk + "\\n" : "Error: " + response.error.message + "\\n");
} else if (resource === "check") {
  response = checks();
  flags.json ? writeJson(response) : process.stdout.write(response.data.status + "\\n" + response.data.checks.map((item) => "- " + item.id + ": " + item.status).join("\\n") + "\\n");
} else if (resource === "dev") {
  const child = spawnSync("pnpm", ["dev"], { stdio: "inherit" });
  process.exitCode = child.status ?? 1;
} else {
  process.stderr.write(usage());
  process.exitCode = 1;
}
`;
  return script + "\n";
}

function buildProjectFiles(composition) {
  const catalog = moduleCatalog();
  return [
    { path: "package.json", contents: buildPackageJson(composition) },
    { path: "tsconfig.json", contents: buildTsConfig() },
    { path: "wrangler.jsonc", contents: buildWranglerJson(composition) },
    { path: "schema.sql", contents: buildSchemaSql() },
    { path: "microservices.lock.json", contents: json(composition.lock) },
    { path: "microservices.config.json", contents: buildMicroservicesConfig(composition) },
    { path: "README.agent.md", contents: buildAgentReadme(composition) },
    { path: "docs/llms.txt", contents: buildLlmGuide(composition) },
    { path: "docs/modules/catalog.json", contents: json(catalog) },
    ...catalog.modules.map((module) => ({ path: docPathFor(module.id), contents: moduleDocMarkdown(module) })),
    { path: "scripts/microservices.js", contents: buildProjectCliJs() },
    { path: "src/index.ts", contents: buildIndexTs(composition) },
    { path: "src/lib/env.ts", contents: buildEnvTs() },
    { path: "src/lib/audit.ts", contents: buildAuditTs() },
    { path: "src/lib/hooks.ts", contents: buildHooksTs(composition) },
    { path: "src/modules/auth.ts", contents: buildAuthModuleTs() },
    { path: "src/modules/customer.ts", contents: buildCustomerModuleTs() },
    { path: "src/modules/booking.ts", contents: buildBookingModuleTs() },
  ];
}

export function listTemplates() {
  return capture(() => listContractTemplates());
}

export function inspectTemplate(id) {
  return capture(() => inspectContractTemplate(id));
}

export function listModules() {
  return capture(() => listContractModules());
}

export function inspectModule(id) {
  return capture(() => inspectContractModule(id));
}

export function listModuleDocs() {
  return capture(() =>
    moduleCatalog().modules.map((module) => ({
      id: module.id,
      name: module.name,
      status: module.status,
      docPath: module.docPath,
      summary: module.summary,
      approvalRisk: module.approvalRisk,
    }))
  );
}

export function getModuleDoc(id) {
  return capture(() => {
    const module = findCatalogModule(id);
    return {
      id: module.id,
      path: module.docPath,
      markdown: moduleDocMarkdown(module),
      module,
    };
  });
}

export function composeApp(input = {}) {
  return capture(() => composeContractApp(input));
}

function lockedModuleIds(input = {}) {
  const lock = input.lock && typeof input.lock === "object" ? input.lock : null;
  if (Array.isArray(input.installedModules)) return input.installedModules;
  if (lock && Array.isArray(lock.modules)) return lock.modules.map((module) => module.id);
  if (input.templateId || input.template || input.modules || input.config) {
    return composeContractApp(input).modules.map((module) => module.id);
  }
  return composeContractApp({ templateId: "booking-business" }).modules.map((module) => module.id);
}

function moduleLock(input = {}) {
  if (input.lock && typeof input.lock === "object") return input.lock;
  return composeContractApp(input).lock;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function stringDiff(fromValues, toValues, hasSnapshot = true) {
  const from = hasSnapshot ? new Set(asStringArray(fromValues)) : new Set();
  const to = new Set(asStringArray(toValues));
  return {
    added: hasSnapshot ? [...to].filter((item) => !from.has(item)) : [],
    removed: hasSnapshot ? [...from].filter((item) => !to.has(item)) : [],
    unchanged: [...to].filter((item) => from.has(item)),
    snapshotAvailable: hasSnapshot,
  };
}

function customizationMatches(value, moduleId) {
  if (typeof value === "string") return value === moduleId || value.startsWith(`${moduleId}:`) || value.startsWith(`${moduleId}/`);
  if (value && typeof value === "object") {
    return value.module === moduleId || value.moduleId === moduleId || value.id === moduleId;
  }
  return false;
}

function matchingCustomizations(items, moduleId) {
  return Array.isArray(items) ? items.filter((item) => customizationMatches(item, moduleId)) : [];
}

function targetContract(module) {
  return {
    mount: module.mount,
    resources: module.resources,
    permissions: module.permissions,
    hooks: module.hooks,
    events: module.events,
    requires: module.requires,
    secrets: module.secrets,
  };
}

function filesForUpgrade(module, diff) {
  const files = new Set(["microservices.lock.json", `docs/modules/${module.id}.md`]);

  if (module.status === "available") {
    files.add(`src/modules/${module.id}.ts`);
  }
  if (diff.resources.added.length || diff.resources.removed.length || module.secrets.length) {
    files.add("wrangler.jsonc");
  }
  if (module.resources.some((resource) => resource.toLowerCase().includes("d1"))) {
    files.add("schema.sql");
  }
  if (diff.hooks.added.length || diff.hooks.removed.length || module.hooks.length) {
    files.add("src/lib/hooks.ts");
  }

  return [...files];
}

export function planAddModule(input = {}) {
  return capture(() => {
    const options = typeof input === "string" ? { moduleId: input } : input;
    const moduleId = options.moduleId ?? options.id;
    if (!moduleId) {
      const error = new Error("Missing module id.");
      error.code = "MODULE_ID_REQUIRED";
      error.remediation = "Pass a module id such as payment-stripe.";
      throw error;
    }

    const module = findCatalogModule(moduleId);
    const installed = new Set(lockedModuleIds(options));
    const alreadyInstalled = installed.has(module.id);
    const missingDependencies = module.requires.filter((id) => !installed.has(id));

    return {
      module,
      action: alreadyInstalled ? "already-installed" : module.status === "available" ? "install" : "planned-install",
      alreadyInstalled,
      missingDependencies,
      approvalRequired: module.approvalRisk === "high" || module.secrets.length > 0 || module.status !== "available",
      requiredSecrets: module.secrets,
      requiredResources: module.resources,
      requiredPermissions: module.permissions,
      filesLikelyTouched: [
        "microservices.lock.json",
        "microservices.config.json",
        "wrangler.jsonc",
        "schema.sql",
        "src/index.ts",
        `src/modules/${module.id}.ts`,
        `docs/modules/${module.id}.md`,
      ],
      nextSteps: [
        "Review the plan with the user.",
        "Request approval for gated side effects.",
        "Apply a branch or patch after approval.",
        "Run checks before preview deployment.",
      ],
    };
  });
}

export function getSecretsStatus(input = {}) {
  return capture(() => {
    const ids = new Set(lockedModuleIds(input));
    const modules = moduleCatalog().modules.filter((module) => ids.has(module.id) || module.secrets.length > 0);
    return {
      secrets: modules.flatMap((module) =>
        module.secrets.map((name) => ({
          module: module.id,
          name,
          configured: false,
          scope: `project/env/module/${module.id}/${name}`,
          valueVisibleToAgent: false,
        }))
      ),
    };
  });
}

export function checkUpdates(input = {}) {
  return capture(() => {
    const lock = moduleLock(input);
    const byId = new Map(moduleCatalog().modules.map((module) => [module.id, module]));
    const current = [];
    const unavailable = [];

    for (const locked of lock.modules ?? []) {
      const module = byId.get(locked.id);
      if (!module) {
        unavailable.push({ id: locked.id, currentVersion: locked.version, reason: "No matching catalog module." });
        continue;
      }
      current.push({
        id: locked.id,
        currentVersion: locked.version,
        latestVersion: module.version,
        status: locked.version === module.version ? "current" : "update-available",
      });
    }

    return {
      schemaVersion: lock.schemaVersion ?? null,
      registryVersion: moduleCatalog().schemaVersion,
      template: lock.template ?? null,
      current,
      available: current.filter((item) => item.status === "update-available"),
      unavailable,
      policy: lock.customizations ?? {
        config: true,
        hooks: [],
        overlays: [],
        forks: [],
      },
    };
  });
}

export function planModuleUpgrade(input = {}) {
  return capture(() => {
    const options = typeof input === "string" ? { moduleId: input } : input;
    const moduleId = options.moduleId ?? options.id;
    if (!moduleId) {
      const error = new Error("Missing module id.");
      error.code = "MODULE_ID_REQUIRED";
      error.remediation = "Pass a module id such as booking.";
      throw error;
    }

    const lock = moduleLock(options);
    const locked = (lock.modules ?? []).find((module) => module.id === moduleId);
    if (!locked) {
      const error = new Error(`Module is not installed: ${moduleId}`);
      error.code = "MODULE_NOT_INSTALLED";
      error.remediation = "Run microservices modules list --json, then plan an upgrade for an installed module.";
      error.details = { moduleId };
      throw error;
    }

    const module = findCatalogModule(moduleId);
    const hasSnapshot = Boolean(locked.contract && typeof locked.contract === "object");
    const currentContract = locked.contract ?? {};
    const nextContract = targetContract(module);
    const upgradeAvailable = locked.version !== module.version;
    const diff = {
      mount:
        hasSnapshot && currentContract.mount !== nextContract.mount
          ? { from: currentContract.mount ?? null, to: nextContract.mount }
          : { from: currentContract.mount ?? nextContract.mount, to: nextContract.mount },
      resources: stringDiff(currentContract.resources, nextContract.resources, hasSnapshot),
      permissions: stringDiff(currentContract.permissions, nextContract.permissions, hasSnapshot),
      hooks: stringDiff(currentContract.hooks, nextContract.hooks, hasSnapshot),
      events: stringDiff(currentContract.events, nextContract.events, hasSnapshot),
      requires: stringDiff(currentContract.requires, nextContract.requires, hasSnapshot),
      secrets: {
        added: upgradeAvailable ? nextContract.secrets : [],
        removed: [],
        unchanged: upgradeAvailable ? [] : nextContract.secrets,
        snapshotAvailable: false,
      },
    };
    const customizations = lock.customizations ?? {};
    const customizationImpact = {
      configPreserved: customizations.config !== false,
      hooksToReview: module.hooks,
      overlaysToReview: matchingCustomizations(customizations.overlays, module.id),
      forksToReview: matchingCustomizations(customizations.forks, module.id),
    };
    const hasForks = customizationImpact.forksToReview.length > 0;
    const hasOverlays = customizationImpact.overlaysToReview.length > 0;
    const changesResources = diff.resources.added.length > 0 || diff.resources.removed.length > 0;
    const changesPermissions = diff.permissions.added.length > 0 || diff.permissions.removed.length > 0;
    const changesSecrets = diff.secrets.added.length > 0 || diff.secrets.removed.length > 0;
    const approvalRequired =
      upgradeAvailable &&
      (module.approvalRisk === "high" || changesSecrets || changesResources || changesPermissions || hasForks || hasOverlays);
    const risk = !upgradeAvailable
      ? "low"
      : approvalRequired || hasForks
        ? "high"
        : hasOverlays || diff.hooks.added.length || diff.hooks.removed.length
          ? "medium"
          : "low";

    return {
      module: {
        id: module.id,
        name: module.name,
        status: module.status,
        currentVersion: locked.version,
        targetVersion: module.version,
      },
      action: upgradeAvailable ? "upgrade-plan" : "no-op",
      upgradeAvailable,
      approvalRequired,
      risk,
      lockfile: {
        schemaVersion: lock.schemaVersion ?? null,
        registryVersion: moduleCatalog().schemaVersion,
        template: lock.template ?? null,
        source: locked.source ?? null,
        checksum: locked.checksum ?? null,
        contractSnapshotAvailable: hasSnapshot,
      },
      diff,
      customizationImpact,
      filesLikelyTouched: upgradeAvailable ? filesForUpgrade(module, diff) : [],
      permissionGate: {
        required: approvalRequired,
        reasons: [
          module.approvalRisk === "high" ? "high-risk module" : null,
          changesSecrets ? "secret changes" : null,
          changesResources ? "resource changes" : null,
          changesPermissions ? "permission changes" : null,
          hasOverlays ? "overlay customizations require merge review" : null,
          hasForks ? "forked module requires manual merge review" : null,
        ].filter(Boolean),
      },
      nextSteps: upgradeAvailable
        ? [
            "Review this plan with the user before modifying source.",
            "Create a branch or patch for the upgrade.",
            "Review hook, overlay, and fork impacts before applying generated changes.",
            "Run pnpm microservices check --json and pnpm typecheck after applying.",
            "Deploy preview only after approval for resources, migrations, webhooks, or secrets.",
          ]
        : [
            "No upgrade is available from the current registry snapshot.",
            "Run microservices updates --json later to check again.",
          ],
    };
  });
}

export function validateConfig(input = {}) {
  return capture(() => {
    const composition = composeContractApp(input);
    const warnings = [];

    if (composition.config.timezone === "UTC") {
      warnings.push("Timezone is still UTC. Set a business timezone before customer testing.");
    }

    if (composition.config.appName === "Booking Business") {
      warnings.push("App name is still the template default. Customize it for demos.");
    }

    return {
      valid: true,
      warnings,
      requiredBindings: composition.bindings,
      requiredStorage: composition.storage,
      customizationMode: composition.upgradePolicy.compatibleCustomization,
    };
  });
}

export function generateProject(input = {}) {
  return capture(() => {
    const composition = composeContractApp(input);
    return {
      composition,
      files: buildProjectFiles(composition),
      nextSteps: [
        "Write files to a target directory.",
        "Run pnpm install in the generated project.",
        "Run pnpm db:init to initialize local D1.",
        "Run pnpm dev to start the generated Worker.",
      ],
    };
  });
}

export function runChecks(input = {}) {
  return capture(() => {
    const composition = composeContractApp(input);
    const checks = [
      {
        id: "module-contract",
        status: "pass",
        message: `${composition.modules.length} modules resolved with explicit contracts.`,
      },
      {
        id: "dependency-resolution",
        status: "pass",
        message: `Resolved order: ${composition.modules.map((module) => module.id).join(" -> ")}.`,
      },
      {
        id: "worker-bindings",
        status: "pass",
        message: `Required bindings: ${composition.bindings.join(", ")}.`,
      },
      {
        id: "hook-surface",
        status: "pass",
        message: `${composition.hooks.length} typed customization hooks exposed.`,
      },
      {
        id: "preview-control-plane",
        status: "pass",
        message: "Preview deployment records and generated artifacts are supported by the API control plane.",
      },
      {
        id: "managed-cloudflare-provisioning",
        status: "pending",
        message: "Guarded D1/KV provisioning is wired; Worker upload and route activation remain pending.",
      },
    ];

    return {
      status: checks.every((check) => check.status === "pass") ? "pass" : "pending",
      checks,
    };
  });
}

export function createMicroservicesClient() {
  return {
    listTemplates,
    inspectTemplate,
    listModules,
    inspectModule,
    listModuleDocs,
    getModuleDoc,
    planAddModule,
    getSecretsStatus,
    checkUpdates,
    planModuleUpgrade,
    composeApp,
    validateConfig,
    generateProject,
    runChecks,
  };
}
