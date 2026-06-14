const CONTRACT_VERSION = "2026-06-13";

const MODULES = Object.freeze([
  {
    id: "auth",
    name: "Auth",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Passwordless account identity, session boundaries, roles, and auth audit events.",
    requires: [],
    optional: ["email", "audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/auth",
      bindings: ["DB", "CACHE_KV"],
    },
    eventsEmitted: ["auth.user_created", "auth.session_created"],
    eventsConsumed: [],
    permissions: ["auth.read", "auth.write", "auth.admin"],
    hooks: [
      {
        name: "beforeSignup",
        timing: "pre",
        purpose: "Validate or enrich a signup request before persistence.",
      },
      {
        name: "afterSignup",
        timing: "post",
        purpose: "Trigger welcome flows, analytics, or CRM sync after account creation.",
      },
    ],
    customization: {
      config: ["allowedEmailDomains", "defaultRole", "sessionTtlSeconds"],
      hooks: ["beforeSignup", "afterSignup"],
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
    eventsConsumed: ["auth.user_created"],
    permissions: ["customer.read", "customer.write", "customer.admin"],
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
]);

const TEMPLATES = Object.freeze([
  {
    id: "booking-business",
    name: "Booking Business",
    version: "0.1.0",
    status: "available",
    summary: "A bookable service business foundation for studios, clinics, consultants, and local operators.",
    targetCustomer: "AI-heavy agencies, consultants, and technical founders building custom booking systems.",
    defaultModules: ["auth", "customer", "booking"],
    optionalModules: ["email", "payment", "admin", "audit-log"],
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
  return MODULES.map(moduleSummary);
}

export function inspectModule(id) {
  return clone(findById(MODULES, id, "module"));
}

export function listTemplates() {
  return TEMPLATES.map(templateSummary);
}

export function inspectTemplate(id) {
  return clone(findById(TEMPLATES, id, "template"));
}

export function resolveModuleIds(moduleIds) {
  const visited = new Set();
  const ordered = [];

  function visit(id) {
    if (visited.has(id)) return;
    const module = inspectModule(id);
    visited.add(id);
    for (const requiredId of module.requires) {
      visit(requiredId);
    }
    ordered.push(id);
  }

  for (const moduleId of moduleIds) {
    visit(moduleId);
  }

  return ordered;
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
    modules: modules.map((module) => ({
      id: module.id,
      version: module.version,
      source: `registry:${module.id}@${module.version}`,
      checksum: `sha256:preview-${module.id}-${module.version}`,
      customizationMode: "config-hooks",
      contract: {
        mount: module.runtime.mount,
        bindings: clone(module.runtime.bindings),
        resources: module.storage.map((item) => item.toUpperCase()),
        permissions: clone(module.permissions),
        hooks: module.hooks.map((hook) => hook.name),
        events: unique([...module.eventsEmitted, ...module.eventsConsumed]),
        requires: clone(module.requires),
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
  const resolvedModuleIds = resolveModuleIds(requestedModules);
  const modules = resolvedModuleIds.map(inspectModule);
  const config = mergeConfig(template.defaultConfig, options.config);

  return {
    schemaVersion: CONTRACT_VERSION,
    compositionId: `cmp_${template.id}_${resolvedModuleIds.join("_")}`,
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
