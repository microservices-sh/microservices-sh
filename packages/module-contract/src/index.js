const CONTRACT_VERSION = "2026-06-13";
const MODULE_SOURCE_REPO = "microservices-sh/microservices-sh";
const MODULE_SOURCE_URL = `https://github.com/${MODULE_SOURCE_REPO}.git`;

function moduleSurfaces({
  admin = null,
  visitor = null,
  agentic = null,
} = {}) {
  return {
    admin: admin ?? { applicable: false },
    visitor: visitor ?? { applicable: false },
    agentic: agentic ?? { applicable: false },
  };
}

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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Auth", path: "/settings/auth", permission: "auth.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["auth.mintToken", "auth.verifyToken", "auth.getJwks"],
        approvalRequired: ["auth.mintToken", "auth.rotateSigningKey"],
      },
    }),
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
    id: "identity",
    name: "Identity",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Passwordless email-code login and server-side sessions backed by auth-scoped service tokens.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "sveltekit",
      mount: "/identity",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Identity", path: "/settings/identity", permission: "identity.admin", icon: "UserRoundCog" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "login",
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.readSession",
          "identity.destroySession",
        ],
        skillPaths: ["skills/identity-operator/SKILL.md"],
        approvalRequired: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.destroySession",
        ],
      },
    }),
    eventsEmitted: [
      "identity.login_code_issued",
      "identity.login_verified",
      "identity.session_created",
      "identity.session_destroyed",
    ],
    eventsConsumed: [],
    permissions: [
      "identity.login",
      "identity.session",
      "identity.admin",
      "identity.extend",
      "identity.observe",
    ],
    rpc: [
      { method: "requestLoginCode", scope: "identity.login", public: false },
      { method: "verifyLoginCode", scope: "identity.login", public: false },
      { method: "readSession", scope: "identity.session", public: false },
      { method: "destroySession", scope: "identity.session", public: false },
    ],
    hooks: [
      {
        name: "beforeVerifyCode",
        timing: "pre",
        purpose: "Guard login code verification before a session is created.",
      },
      {
        name: "afterSessionCreated",
        timing: "post",
        purpose: "Observe session creation for audit, notification, or login support workflows.",
      },
    ],
    customization: {
      config: ["sessionTtlSeconds", "loginCodeTtlSeconds"],
      hooks: ["beforeVerifyCode", "afterSessionCreated"],
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Gateway", path: "/settings/api-keys", permission: "gateway.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["gateway.issueToken", "gateway.inspectRateLimit"],
        approvalRequired: ["gateway.issueToken", "gateway.createApiKey", "gateway.revokeApiKey"],
      },
    }),
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Customers", path: "/customers", permission: "customer.read", icon: "Users" }],
      },
      visitor: {
        applicable: true,
        featureKey: "memberProfile",
      },
      agentic: {
        applicable: true,
        tools: ["customer.getCustomer", "customer.listCustomers", "customer.upsertCustomer"],
        approvalRequired: ["customer.upsertCustomer", "customer.deleteCustomer"],
      },
    }),
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Bookings", path: "/bookings", permission: "booking.read", icon: "CalendarDays" }],
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
      },
      agentic: {
        applicable: true,
        tools: ["booking.listBookings", "booking.getBooking", "booking.getAvailability", "booking.createBooking", "booking.cancelBooking"],
        approvalRequired: ["booking.createBooking", "booking.cancelBooking"],
      },
    }),
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Audit Log", path: "/settings/audit-log", permission: "audit.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["audit.listEvents", "audit.exportEvents"],
        approvalRequired: ["audit.exportEvents"],
      },
    }),
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Payments", path: "/payments", permission: "payment.read", icon: "CreditCard" }],
      },
      visitor: {
        applicable: true,
        featureKey: "payments",
      },
      agentic: {
        applicable: true,
        tools: ["payment.createPaymentIntent", "payment.listPayments", "payment.refundPayment"],
        approvalRequired: ["payment.createPaymentIntent", "payment.refundPayment"],
      },
    }),
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
    id: "billing-subscriptions",
    name: "Billing & Subscriptions",
    version: "0.1.0",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "Recurring plans and subscription state on top of Stripe: a complete status state machine, idempotent webhook application, plan changes, metered usage, and dunning hooks.",
    requires: [],
    optional: ["payment", "org-team-rbac", "jobs-workflows", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/billing",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Billing", path: "/settings/billing", permission: "billing.read", icon: "Receipt" }],
      },
      agentic: {
        applicable: true,
        tools: ["billing.listPlans", "billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
        approvalRequired: ["billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
      },
    }),
    eventsEmitted: [
      "subscription.started",
      "subscription.activated",
      "subscription.past_due",
      "subscription.canceled",
      "subscription.plan_changed",
    ],
    eventsConsumed: [],
    permissions: [
      "billing.read",
      "billing.write",
      "billing.admin",
      "billing-subscriptions.extend",
      "billing-subscriptions.observe",
    ],
    rpc: [
      { method: "startSubscription", scope: "billing.write", public: false },
      { method: "applyStripeEvent", scope: "billing.write", public: false },
    ],
    hooks: [
      {
        name: "beforeSubscriptionChange",
        timing: "pre",
        purpose: "Guard or adjust a subscription transition before it is persisted.",
      },
      {
        name: "onSubscriptionActivated",
        timing: "post",
        purpose: "Observe activation to grant access, notify users, or update downstream records.",
      },
      {
        name: "onSubscriptionPastDue",
        timing: "post",
        purpose: "Observe past-due transitions to start dunning or restrict risky operations.",
      },
    ],
    customization: {
      config: ["plans", "trialDays", "usageMeters", "dunning"],
      hooks: ["beforeSubscriptionChange", "onSubscriptionActivated", "onSubscriptionPastDue"],
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
    surfaces: moduleSurfaces({
      agentic: {
        applicable: true,
        tools: ["idempotency.getRecord", "idempotency.inspectReplay"],
      },
    }),
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
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Webhooks", path: "/settings/webhooks", permission: "webhook.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["webhook.listEndpoints", "webhook.registerEndpoint", "webhook.deliverTestEvent"],
        approvalRequired: ["webhook.registerEndpoint", "webhook.deliverTestEvent"],
      },
    }),
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
  {
    id: "document-extraction",
    name: "Document Extraction",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary:
      "Local-first scanned document extraction: file references, OCR/LLM drafts, schema normalization, source evidence, human review, and governed Gemma/AI fallback.",
    requires: [],
    optional: ["auth", "org-team-rbac", "audit-log", "file-media", "forms-intake", "ai-gateway", "jobs-workflows", "invoice", "customer", "support-ticket"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/documents",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Documents", path: "/documents", permission: "document-extraction.read", icon: "FileText" }],
      },
      visitor: {
        applicable: true,
        featureKey: "documentIntake",
      },
      agentic: {
        applicable: true,
        tools: [
          "document-extraction.createExtractionJob",
          "document-extraction.submitExtractionDraft",
          "document-extraction.reviewExtraction",
          "document-extraction.getExtractionJob",
          "document-extraction.listExtractionJobs",
          "document-extraction.normalizeExtraction",
        ],
        approvalRequired: [
          "document-extraction.reviewExtraction",
          "document-extraction.normalizeExtraction",
          "document-extraction.modelDownload",
          "ai-gateway.complete",
        ],
      },
    }),
    eventsEmitted: [
      "document-extraction.job_created",
      "document-extraction.draft_submitted",
      "document-extraction.approved",
      "document-extraction.rejected",
      "document-extraction.failed",
    ],
    eventsConsumed: [],
    permissions: [
      "document-extraction.read",
      "document-extraction.write",
      "document-extraction.review",
      "document-extraction.admin",
      "document-extraction.extend",
      "document-extraction.observe",
    ],
    rpc: [
      { method: "createExtractionJob", scope: "document-extraction.write", public: false },
      { method: "submitExtractionDraft", scope: "document-extraction.write", public: false },
      { method: "reviewExtraction", scope: "document-extraction.review", public: false },
      { method: "getExtractionJob", scope: "document-extraction.read", public: false },
      { method: "listExtractionJobs", scope: "document-extraction.read", public: false },
      { method: "normalizeExtraction", scope: "document-extraction.write", public: false },
    ],
    hooks: [
      {
        name: "beforeExtractionJobCreate",
        timing: "pre",
        purpose: "Guard document intake, schema selection, and file references before a review job is created.",
      },
      {
        name: "beforeExtractionDraftSubmit",
        timing: "pre",
        purpose: "Reject or adjust OCR/LLM drafts before they enter the review queue.",
      },
      {
        name: "afterExtractionReviewed",
        timing: "post",
        purpose: "Observe approval/rejection for audit, notifications, or target-record creation.",
      },
    ],
    customization: {
      config: ["mode", "reviewRequired", "minConfidenceForApproval", "localBrowser", "gatewayFallback", "sidecar"],
      hooks: ["beforeExtractionJobCreate", "beforeExtractionDraftSubmit", "afterExtractionReviewed"],
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
    id: "code-memory",
    name: "Code Memory",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Trusted Sources, immutable source versions, Logic Capsules, and audit events for private reusable code memory.",
    requires: ["identity"],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/code-memory",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Code Memory", path: "/code-memory", permission: "code-memory.read", icon: "DatabaseZap" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "code-memory.addTrustedSource",
          "code-memory.listTrustedSources",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.searchLogicCapsules",
          "code-memory.getLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
        skillPaths: ["skills/code-memory-operator/SKILL.md"],
        approvalRequired: [
          "code-memory.addTrustedSource",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
      },
    }),
    eventsEmitted: [
      "code-memory.source.added",
      "code-memory.source.scanned",
      "code-memory.capsule.created",
      "code-memory.capsule.approved",
      "code-memory.capsule.rejected",
      "code-memory.capsule.retrieved",
    ],
    eventsConsumed: [],
    permissions: [
      "code-memory.read",
      "code-memory.write",
      "code-memory.approve",
      "code-memory.admin",
      "code-memory.observe",
    ],
    rpc: [
      { method: "addTrustedSource", scope: "code-memory.write", public: false },
      { method: "listTrustedSources", scope: "code-memory.read", public: false },
      { method: "recordSourceScan", scope: "code-memory.write", public: false },
      { method: "createLogicCapsule", scope: "code-memory.write", public: false },
      { method: "searchLogicCapsules", scope: "code-memory.read", public: false },
      { method: "getLogicCapsule", scope: "code-memory.read", public: false },
      { method: "approveLogicCapsule", scope: "code-memory.approve", public: false },
      { method: "rejectLogicCapsule", scope: "code-memory.approve", public: false },
    ],
    hooks: [
      {
        name: "beforeTrustedSourceAdd",
        timing: "pre",
        purpose: "Guard repository URL, visibility, and allowed paths before adding a Trusted Source.",
      },
      {
        name: "beforeLogicCapsuleCreate",
        timing: "pre",
        purpose: "Reject or adjust candidate capsule metadata before persistence.",
      },
      {
        name: "afterLogicCapsuleRetrieved",
        timing: "post",
        purpose: "Observe approved capsule retrieval for audit or usage reporting.",
      },
    ],
    customization: {
      config: ["defaultProvider", "maxAllowedPaths"],
      hooks: ["beforeTrustedSourceAdd", "beforeLogicCapsuleCreate", "afterLogicCapsuleRetrieved"],
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
    id: "operator-work",
    name: "Operator Work",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Agent-readable task board, focus plan, daily review, and auditable operator work state for DOT AI OS.",
    requires: [],
    optional: ["org-team-rbac", "audit-log", "jobs-workflows", "calendar-google", "email"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/operator-work",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Operator Work", path: "/operator-work", permission: "operator-work.read", icon: "ListTodo" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "operator-work.getOperatorWorkbench",
          "operator-work.listOperatorTasks",
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.listFocusBlocks",
          "operator-work.upsertFocusBlock",
          "operator-work.listDailyReviews",
          "operator-work.saveDailyReview",
        ],
        skillPaths: ["skills/operator-work-operator/SKILL.md"],
        approvalRequired: [
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.upsertFocusBlock",
          "operator-work.saveDailyReview",
        ],
      },
    }),
    eventsEmitted: [
      "operator-work.task.upserted",
      "operator-work.task.status_changed",
      "operator-work.focus_block.upserted",
      "operator-work.daily_review.saved",
    ],
    eventsConsumed: [],
    permissions: [
      "operator-work.read",
      "operator-work.write",
      "operator-work.admin",
      "operator-work.extend",
      "operator-work.observe",
    ],
    rpc: [
      { method: "getOperatorWorkbench", scope: "operator-work.read", public: false },
      { method: "listOperatorTasks", scope: "operator-work.read", public: false },
      { method: "upsertOperatorTask", scope: "operator-work.write", public: false },
      { method: "updateOperatorTaskStatus", scope: "operator-work.write", public: false },
      { method: "listFocusBlocks", scope: "operator-work.read", public: false },
      { method: "upsertFocusBlock", scope: "operator-work.write", public: false },
      { method: "listDailyReviews", scope: "operator-work.read", public: false },
      { method: "saveDailyReview", scope: "operator-work.write", public: false },
    ],
    hooks: [
      {
        name: "beforeOperatorTaskUpsert",
        timing: "pre",
        purpose: "Normalize or guard task writes before persistence.",
      },
      {
        name: "afterOperatorTaskUpdated",
        timing: "post",
        purpose: "Observe created or updated tasks for audit, notifications, or agent handoff workflows.",
      },
      {
        name: "beforeFocusBlockUpsert",
        timing: "pre",
        purpose: "Normalize or guard focus plan writes before persistence.",
      },
      {
        name: "beforeDailyReviewSave",
        timing: "pre",
        purpose: "Normalize or guard daily review saves before persistence.",
      },
    ],
    customization: {
      config: ["maxTasks", "allowAgentDrafts", "requireReviewBeforeUnlock"],
      hooks: ["beforeOperatorTaskUpsert", "afterOperatorTaskUpdated", "beforeFocusBlockUpsert", "beforeDailyReviewSave"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
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
    ...(module.interactive ? { interactive: clone(module.interactive) } : {}),
    ...(module.skills ? { skills: clone(module.skills) } : {}),
    ...(module.surfaces ? { surfaces: clone(module.surfaces) } : {}),
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
    ...(template.interactive ? { interactive: clone(template.interactive) } : {}),
    ...(template.skills ? { skills: clone(template.skills) } : {}),
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
        surfaces: clone(module.surfaces ?? {}),
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
