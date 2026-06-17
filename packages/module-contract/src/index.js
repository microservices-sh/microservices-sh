const CONTRACT_VERSION = "2026-06-13";
const MODULE_SOURCE_REPO = "microservices-sh/microservices-sh";
const MODULE_SOURCE_URL = `https://github.com/${MODULE_SOURCE_REPO}.git`;

const MODULES = Object.freeze([
  {
    id: "auth",
    name: "Auth",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "EdDSA service-token mint/verify, scope checks, and JWKS for auth-gated inter-service communication.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/auth",
      bindings: ["DB"],
    },
    eventsEmitted: ["auth.token_minted", "auth.key_rotated"],
    eventsConsumed: [],
    permissions: ["auth.mint", "auth.verify", "auth.admin"],
    rpc: [
      { method: "mintToken", scope: "auth.mint", public: false },
      { method: "verifyToken", scope: "auth.verify", public: false },
      { method: "getJwks", scope: null, public: true },
    ],
    hooks: [
      {
        name: "beforeMintToken",
        timing: "pre",
        purpose: "Clamp or narrow requested scopes and ttl before signing.",
      },
      {
        name: "afterTokenMinted",
        timing: "post",
        purpose: "Observe or augment a minted token result.",
      },
    ],
    customization: {
      config: ["defaultTtlSeconds", "issuer", "jwksCacheSeconds"],
      hooks: ["beforeMintToken", "afterTokenMinted"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "gateway",
    name: "Gateway",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Public trust boundary: API-key authentication, rate limiting, scope narrowing, and token exchange via auth.",
    requires: ["auth"],
    optional: ["audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/gateway",
      bindings: ["DB", "RATE_LIMIT_KV"],
    },
    eventsEmitted: ["gateway.token_issued", "gateway.access_denied"],
    eventsConsumed: [],
    permissions: ["gateway.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeIssueToken",
        timing: "pre",
        purpose: "Narrow scopes, attach claims, or reject issuance before minting.",
      },
      {
        name: "afterTokenIssued",
        timing: "post",
        purpose: "Observe issued tokens for analytics or audit.",
      },
    ],
    customization: {
      config: ["tokenTtlSeconds", "rateLimit", "rateWindowSeconds"],
      hooks: ["beforeIssueToken", "afterTokenIssued"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "customer",
    name: "Customer",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Customer profiles, tags, lifecycle state, consent fields, and customer events.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/customers",
      bindings: ["DB"],
    },
    eventsEmitted: ["customer.created", "customer.updated"],
    eventsConsumed: [],
    permissions: ["customer.read", "customer.write", "customer.admin"],
    rpc: [
      { method: "getCustomer", scope: "customer.read", public: false },
      { method: "listCustomers", scope: "customer.read", public: false },
      { method: "upsertCustomer", scope: "customer.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCustomerCreate",
        timing: "pre",
        purpose: "Normalize incoming customer data and enforce business-specific required fields.",
      },
      {
        name: "afterCustomerUpdated",
        timing: "post",
        purpose: "Sync customer changes to external CRMs or notification flows.",
      },
    ],
    customization: {
      config: ["profileFields", "tags", "segments", "consentFields"],
      hooks: ["beforeCustomerCreate", "afterCustomerUpdated"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "booking",
    name: "Booking",
    version: "0.1.0",
    status: "available",
    category: "vertical",
    summary: "Service booking, availability, cancellation windows, confirmation, and booking events.",
    requires: ["auth", "customer"],
    optional: ["payment", "email", "staff", "audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/bookings",
      bindings: ["DB", "CACHE_KV", "NOTIFICATIONS"],
    },
    eventsEmitted: ["booking.created", "booking.confirmed", "booking.cancelled"],
    eventsConsumed: ["customer.created", "payment.succeeded"],
    permissions: ["booking.read", "booking.write", "booking.admin"],
    rpc: [
      { method: "listBookings", scope: "booking.read", public: false },
      { method: "getBooking", scope: "booking.read", public: false },
      { method: "getAvailability", scope: "booking.read", public: false },
    ],
    hooks: [
      {
        name: "beforeBookingCreate",
        timing: "pre",
        purpose: "Validate booking rules before a booking record is created.",
      },
      {
        name: "calculateAvailability",
        timing: "compute",
        purpose: "Replace or adjust generated availability slots with business-specific rules.",
      },
      {
        name: "afterBookingConfirmed",
        timing: "post",
        purpose: "Run post-confirmation workflows such as reminders or payment capture.",
      },
    ],
    customization: {
      config: [
        "serviceTypes",
        "slotIntervalMinutes",
        "defaultDurationMinutes",
        "leadTimeMinutes",
        "cancellationWindowHours",
        "allowWaitlist",
      ],
      hooks: ["beforeBookingCreate", "calculateAvailability", "afterBookingConfirmed"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "audit-log",
    name: "Audit Log",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Append-only audit trail. Pure event sink: records domain events from a signed queue or direct calls.",
    requires: [],
    optional: [],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/audit",
      bindings: ["DB"],
    },
    eventsEmitted: ["audit.recorded", "audit.exported"],
    eventsConsumed: [],
    permissions: ["audit.read", "audit.export", "audit.admin"],
    rpc: [],
    hooks: [
      {
        name: "redactAuditPayload",
        timing: "pre",
        purpose: "Redact or drop sensitive fields before an audit record is persisted.",
      },
      {
        name: "beforeAuditExport",
        timing: "pre",
        purpose: "Filter or guard an audit export request.",
      },
    ],
    customization: {
      config: ["requireSignedEnvelope", "defaultListLimit"],
      hooks: ["redactAuditPayload", "beforeAuditExport"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "payment",
    name: "Payment",
    version: "0.1.0",
    status: "available",
    category: "provider",
    summary: "Stripe-backed payment provider: create payment intents, record payments, and verify signed Stripe webhooks. Emits payment lifecycle events.",
    requires: ["auth", "customer"],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/payments",
      bindings: ["DB"],
    },
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    eventsEmitted: ["payment.checkout_created", "payment.succeeded", "payment.refunded", "payment.failed"],
    eventsConsumed: [],
    permissions: ["payment.read", "payment.write", "payment.admin"],
    rpc: [
      { method: "createPaymentIntent", scope: "payment.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCreatePaymentIntent",
        timing: "pre",
        purpose: "Adjust or validate intent input before the gateway call.",
      },
      {
        name: "afterPaymentSucceeded",
        timing: "post",
        purpose: "Run side-effects after a payment is marked succeeded.",
      },
    ],
    customization: {
      config: ["defaultCurrency", "requireWebhookSecret", "defaultListLimit"],
      hooks: ["beforeCreatePaymentIntent", "afterPaymentSucceeded"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "idempotency",
    name: "Idempotency",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention.",
    requires: [],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/idempotency",
      bindings: ["DB"],
    },
    eventsEmitted: [
      "idempotency.claimed",
      "idempotency.replayed",
      "idempotency.completed",
      "idempotency.failed",
      "idempotency.expired_pruned",
    ],
    eventsConsumed: [],
    permissions: ["idempotency.claim", "idempotency.read", "idempotency.admin"],
    rpc: [
      { method: "claimIdempotency", scope: "idempotency.claim", public: false },
      { method: "getIdempotencyRecord", scope: "idempotency.read", public: false },
    ],
    hooks: [
      {
        name: "beforeIdempotencyClaim",
        timing: "pre",
        purpose: "Validate, enrich, or reject a claim before it is persisted or replayed.",
      },
      {
        name: "afterIdempotencyComplete",
        timing: "post",
        purpose: "Observe a completed idempotency record for audit or activity feeds.",
      },
      {
        name: "onIdempotencyReplay",
        timing: "post",
        purpose: "Observe terminal record replay without creating a duplicate side effect.",
      },
    ],
    customization: {
      config: ["defaultTtlMs", "defaultLockTtlMs", "maxTtlMs"],
      hooks: ["beforeIdempotencyClaim", "afterIdempotencyComplete", "afterIdempotencyFail", "onIdempotencyReplay"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "webhook-delivery",
    name: "Webhook Delivery",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Outbound mirror of the event bus: registers external endpoints (per-endpoint signing secret), delivers HMAC-signed domain events, and logs delivery attempts.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/webhooks",
      bindings: ["DB"],
    },
    // External outbound HTTP side-effects make this approval-gated despite being
    // a sink (audit-log, also a sink, stays medium — it never leaves the account).
    approvalRisk: "high",
    secrets: [],
    eventsEmitted: ["webhook.delivered", "webhook.failed"],
    eventsConsumed: [],
    permissions: ["webhook.read", "webhook.write", "webhook.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeWebhookDeliver",
        timing: "pre",
        purpose: "Adjust or drop an outbound event before delivery.",
      },
      {
        name: "afterWebhookDelivered",
        timing: "post",
        purpose: "Observe a delivery attempt result.",
      },
    ],
    customization: {
      config: ["defaultListLimit", "maxRetries"],
      hooks: ["beforeWebhookDeliver", "afterWebhookDelivered"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
]);

const TEMPLATES = Object.freeze([
  {
    id: "booking-business",
    name: "Booking Business",
    version: "0.1.0",
    status: "available",
    summary: "A bookable service business foundation for studios, clinics, consultants, and local operators.",
    targetCustomer: "AI-heavy agencies, consultants, and technical founders building custom booking systems.",
    defaultModules: ["gateway", "auth", "customer", "booking"],
    optionalModules: ["email", "payment", "admin", "audit-log", "idempotency", "webhook-delivery"],
    targetRuntime: {
      language: "typescript",
      framework: "hono",
      platform: "cloudflare-workers",
      storage: ["d1", "kv"],
    },
    defaultConfig: {
      appName: "Booking Business",
      appSlug: "booking-business",
      timezone: "UTC",
      currency: "USD",
      auth: {
        defaultRole: "member",
        sessionTtlSeconds: 604800,
      },
      customer: {
        profileFields: ["name", "email", "phone", "notes"],
        consentFields: ["emailMarketingConsent"],
      },
      booking: {
        serviceTypes: ["consultation", "standard-service"],
        slotIntervalMinutes: 30,
        defaultDurationMinutes: 60,
        leadTimeMinutes: 120,
        cancellationWindowHours: 24,
        maxFutureDays: 90,
        allowWaitlist: false,
      },
    },
    successCriteria: [
      "Generated Hono Worker can run locally with Wrangler.",
      "Generated schema includes account, customer, booking, event, and audit tables.",
      "Hooks are explicit files an agent can customize without changing module internals.",
      "Module lock records exact module versions used for upgrade comparison.",
    ],
  },
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function createContractError(code, message, remediation, details = {}) {
  const error = new Error(message);
  error.name = "MicroservicesContractError";
  error.code = code;
  error.remediation = remediation;
  error.details = details;
  return error;
}

function moduleSummary(module) {
  return {
    id: module.id,
    name: module.name,
    version: module.version,
    status: module.status,
    category: module.category,
    summary: module.summary,
    requires: clone(module.requires),
    mount: module.runtime.mount,
  };
}

function templateSummary(template) {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    status: template.status,
    summary: template.summary,
    defaultModules: clone(template.defaultModules),
    optionalModules: clone(template.optionalModules),
  };
}

function findById(items, id, kind) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw createContractError(
      `${kind.toUpperCase()}_NOT_FOUND`,
      `Unknown ${kind}: ${id}`,
      `Run "${kind}s list --json" and select one of the returned ids.`,
      { id }
    );
  }
  return item;
}

export function parseModuleRef(value, explicitVersion = null) {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  const at = raw.lastIndexOf("@");
  const inline =
    at > 0
      ? {
          id: raw.slice(0, at),
          version: raw.slice(at + 1) || null,
        }
      : {
          id: raw,
          version: null,
        };
  const version = explicitVersion ? String(explicitVersion).trim() : inline.version;

  if (inline.version && explicitVersion && inline.version !== String(explicitVersion).trim()) {
    throw createContractError(
      "MODULE_VERSION_CONFLICT",
      `Conflicting versions requested for module ${inline.id}.`,
      "Use either module@version or --version/--to, not both with different versions.",
      { moduleId: inline.id, inlineVersion: inline.version, explicitVersion: String(explicitVersion).trim() }
    );
  }

  return {
    id: inline.id,
    version,
    raw,
  };
}

export function availableModuleVersions(id) {
  const versions = MODULES.filter((candidate) => candidate.id === id).map((module) => module.version);
  if (!versions.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id }
    );
  }
  return unique(versions);
}

function findModuleByRef(ref, explicitVersion = null) {
  const selector = parseModuleRef(ref, explicitVersion);
  const candidates = MODULES.filter((candidate) => candidate.id === selector.id);
  if (!candidates.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${selector.id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id: selector.id }
    );
  }

  const module = selector.version
    ? candidates.find((candidate) => candidate.version === selector.version)
    : candidates[candidates.length - 1];
  if (!module) {
    throw createContractError(
      "MODULE_VERSION_NOT_FOUND",
      `Module ${selector.id}@${selector.version} is not available in this registry snapshot.`,
      "Select one of the available versions or omit the version to use the current registry version.",
      {
        id: selector.id,
        moduleId: selector.id,
        requestedVersion: selector.version,
        availableVersions: candidates.map((candidate) => candidate.version),
      }
    );
  }

  return module;
}

function moduleRefString(module) {
  return `${module.id}@${module.version}`;
}

export function moduleReleaseTag(id, version) {
  return `modules/${id}/v${version}`;
}

export function moduleSourceRef(input, version = null) {
  const module = typeof input === "string" ? { id: input, version } : input;
  return {
    type: "git",
    repo: MODULE_SOURCE_REPO,
    url: MODULE_SOURCE_URL,
    tag: moduleReleaseTag(module.id, module.version),
    ref: `refs/tags/${moduleReleaseTag(module.id, module.version)}`,
    path: `modules/${module.id}`,
  };
}

function resolveModuleRefs(moduleRefs) {
  const explicitVersions = new Map();
  for (const value of moduleRefs) {
    const ref = parseModuleRef(value);
    if (!ref.id || !ref.version) continue;
    const existing = explicitVersions.get(ref.id);
    if (existing && existing !== ref.version) {
      throw createContractError(
        "MODULE_VERSION_CONFLICT",
        `Conflicting versions requested for module ${ref.id}.`,
        "Request a single version for each module.",
        { moduleId: ref.id, requestedVersions: [existing, ref.version] }
      );
    }
    explicitVersions.set(ref.id, ref.version);
  }

  const visited = new Set();
  const ordered = [];

  function visit(value) {
    const ref = parseModuleRef(value);
    const version = explicitVersions.get(ref.id) ?? ref.version;
    const module = findModuleByRef(ref.id, version);
    if (visited.has(module.id)) return;
    visited.add(module.id);
    for (const requiredId of module.requires) {
      visit(requiredId);
    }
    ordered.push(module);
  }

  for (const moduleRef of moduleRefs) {
    visit(moduleRef);
  }

  return ordered;
}

function mergeConfig(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return clone(base);
  }

  const output = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeConfig(output[key], value);
    } else {
      output[key] = clone(value);
    }
  }
  return output;
}

export function listModules() {
  return MODULES.map((module) => ({
    ...moduleSummary(module),
    latestVersion: module.version,
    availableVersions: availableModuleVersions(module.id),
    sourceRef: moduleSourceRef(module),
  }));
}

export function inspectModule(id) {
  return clone(findModuleByRef(id));
}

export function listTemplates() {
  return TEMPLATES.map(templateSummary);
}

export function inspectTemplate(id) {
  return clone(findById(TEMPLATES, id, "template"));
}

export function resolveModuleIds(moduleIds) {
  return resolveModuleRefs(moduleIds).map((module) => module.id);
}

export function createModuleLock(modules, template = null) {
  return {
    schemaVersion: CONTRACT_VERSION,
    generatedAt: "deterministic-local-preview",
    registry: {
      id: "microservices.sh",
      contractVersion: CONTRACT_VERSION,
    },
    generator: {
      package: "create-microservices-app",
      version: "0.0.0",
    },
    template: template
      ? {
          id: template.id,
          version: template.version,
          source: `registry:${template.id}@${template.version}`,
          checksum: `sha256:preview-${template.id}-${template.version}`,
        }
      : null,
    // App-level deploy topology (plans/24). Default is embedded; service mode is
    // opt-in and recorded per-module below.
    deploy: { mode: "embedded" },
    modules: modules.map((module) => ({
      id: module.id,
      version: module.version,
      source: `registry:${module.id}@${module.version}`,
      sourceRef: moduleSourceRef(module),
      checksum: `sha256:preview-${module.id}-${module.version}`,
      customizationMode: "config-hooks",
      // Per-module topology. In service mode this also carries worker + d1 names.
      mode: "embedded",
      contract: {
        mount: module.runtime.mount,
        bindings: clone(module.runtime.bindings),
        resources: module.storage.map((item) => item.toUpperCase()),
        permissions: clone(module.permissions),
        rpc: clone(module.rpc ?? []),
        hooks: module.hooks.map((hook) => hook.name),
        events: unique([...module.eventsEmitted, ...module.eventsConsumed]),
        requires: clone(module.requires),
        secrets: clone(module.secrets ?? []),
      },
    })),
    customizations: {
      config: true,
      hooks: modules.flatMap((module) => module.customization?.hooks ?? []),
      overlays: [],
      forks: [],
    },
  };
}

export function composeApp(input = {}) {
  const options = typeof input === "string" ? { templateId: input } : input;
  const templateId = options.templateId ?? options.template ?? "booking-business";
  const template = inspectTemplate(templateId);
  const requestedModules = unique([
    ...template.defaultModules,
    ...(options.modules ?? []),
  ]);
  const modules = resolveModuleRefs(requestedModules).map(clone);
  const resolvedModuleIds = modules.map((module) => module.id);
  const config = mergeConfig(template.defaultConfig, options.config);

  return {
    schemaVersion: CONTRACT_VERSION,
    compositionId: `cmp_${template.id}_${modules.map(moduleRefString).join("_")}`,
    template: templateSummary(template),
    config,
    modules,
    routes: modules.map((module) => ({
      module: module.id,
      mount: module.runtime.mount,
      framework: module.runtime.framework,
    })),
    bindings: unique(modules.flatMap((module) => module.runtime.bindings)),
    storage: unique(modules.flatMap((module) => module.storage)),
    permissions: unique(modules.flatMap((module) => module.permissions)),
    events: {
      emitted: unique(modules.flatMap((module) => module.eventsEmitted)),
      consumed: unique(modules.flatMap((module) => module.eventsConsumed)),
    },
    hooks: modules.flatMap((module) =>
      module.hooks.map((hook) => ({
        module: module.id,
        ...hook,
      }))
    ),
    checks: [
      "module-contract",
      "dependency-resolution",
      "worker-bindings",
      "schema-presence",
      "hook-surface",
      "audit-events",
    ],
    upgradePolicy: {
      mode: "contract-lock",
      lockfile: "microservices.lock.json",
      compatibleCustomization: ["config", "hooks"],
      manualCustomization: ["fork", "export"],
    },
    lock: createModuleLock(modules, template),
  };
}

export { CONTRACT_VERSION };
