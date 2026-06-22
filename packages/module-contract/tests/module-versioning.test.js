import { describe, expect, it } from "vitest";
import {
  composeApp,
  inspectModule,
  inspectTemplate,
  listModules,
  listTemplates,
  moduleReleaseTag,
  moduleSourceRef,
  parseModuleRef,
  resolveModuleIds,
} from "../src/index.js";

const BILLING_SUBSCRIPTION_PERMISSIONS = [
  "billing.read",
  "billing.write",
  "billing.admin",
  "billing-subscriptions.extend",
  "billing-subscriptions.observe",
];

const BILLING_SUBSCRIPTION_EVENTS = [
  "subscription.started",
  "subscription.activated",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.plan_changed",
];

const STACKSUITE_CATALOG_IDS = [
  "product-catalog",
  "inventory",
  "sales-order",
  "estimate-quote",
  "recurring-documents",
  "shipment",
  "commerce-sync",
  "accounting-core",
  "accounts-payable",
  "accounts-receivable",
  "bank-reconciliation",
];

const FOUNDATION_CATALOG_IDS = [
  "org-team-rbac",
  "admin-shell",
  "file-media",
  "jobs-workflows",
  "notifications-inapp",
  "support-ticket",
];

const LOCKED_TEMPLATE_CATALOG_IDS = [
  "accounting-core",
  "accounts-payable",
  "accounts-receivable",
  "admin-shell",
  "ads-manager",
  "audit-log",
  "auth",
  "bank-reconciliation",
  "billing-subscriptions",
  "booking",
  "commerce-sync",
  "customer",
  "email",
  "estimate-quote",
  "file-media",
  "forms-intake",
  "gateway",
  "identity",
  "image-generation",
  "inventory",
  "invoice",
  "jobs-workflows",
  "knowledge-base-rag",
  "marketing-research",
  "membership-credits",
  "notifications-inapp",
  "operator-work",
  "org-team-rbac",
  "payment",
  "product-catalog",
  "project-progress",
  "recurring-documents",
  "sales-order",
  "shipment",
  "sms-campaigns",
  "storage-entitlements",
  "support-inbox",
  "support-ticket",
  "webhook-delivery",
];

const BUNDLED_REPO_TEMPLATE_IDS = [
  "booking-sveltekit",
  "company-landing-astro",
  "wordpress-emdash-blog-astro",
  "saas-starter-sveltekit",
  "saas-growth-sveltekit",
  "client-portal-sveltekit",
  "dot-ai-os",
  "erp-shell-sveltekit",
  "commerce-ops-sveltekit",
  "accounting-erp-sveltekit",
];

describe("module version selectors", () => {
  it("parses inline module versions", () => {
    expect(parseModuleRef("auth@0.1.0")).toEqual({
      id: "auth",
      version: "0.1.0",
      raw: "auth@0.1.0",
    });
  });

  it("inspects an exact available module version", () => {
    expect(inspectModule("auth@0.1.0")).toMatchObject({
      id: "auth",
      version: "0.1.0",
    });
  });

  it("rejects unavailable module versions", () => {
    expect(() => inspectModule("auth@9.9.9")).toThrow(/not available/);
  });

  it("uses explicit pins while resolving dependencies", () => {
    expect(resolveModuleIds(["payment@0.1.0"])).toEqual(["auth", "customer", "payment"]);
  });

  it("resolves Code Memory through its identity dependency", () => {
    expect(resolveModuleIds(["code-memory@0.1.0"])).toEqual(["auth", "identity", "code-memory"]);

    const composition = composeApp({ templateId: "booking-business", modules: ["code-memory"] });
    expect(composition.modules.map((module) => module.id)).toEqual([
      "auth",
      "gateway",
      "customer",
      "booking",
      "identity",
      "code-memory",
    ]);
    expect(composition.lock.modules.map((module) => module.id)).toEqual(composition.modules.map((module) => module.id));
  });

  it("exposes bundled repo-style templates in the contract catalog", () => {
    const templateIds = listTemplates().map((template) => template.id);
    expect(templateIds).toEqual(expect.arrayContaining(BUNDLED_REPO_TEMPLATE_IDS));

    const commerce = inspectTemplate("commerce-ops-sveltekit");
    expect(commerce.targetRuntime).toMatchObject({ framework: "sveltekit", platform: "cloudflare-workers" });
    expect(commerce.defaultModules).toEqual(expect.arrayContaining(["commerce-sync", "sales-order", "shipment"]));

    const accounting = composeApp({ templateId: "accounting-erp-sveltekit" });
    expect(accounting.modules.map((module) => module.id)).toEqual(expect.arrayContaining([
      "accounting-core",
      "accounts-payable",
      "accounts-receivable",
      "bank-reconciliation",
    ]));
    expect(accounting.lock.template.id).toBe("accounting-erp-sveltekit");
  });

  it("models subscription billing as a provider-backed customer app module", () => {
    expect(resolveModuleIds(["billing-subscriptions@0.1.0"])).toEqual(["billing-subscriptions"]);
    expect(inspectModule("billing-subscriptions@0.1.0")).toMatchObject({
      id: "billing-subscriptions",
      category: "provider",
      approvalRisk: "high",
      requires: [],
      optional: ["payment", "org-team-rbac", "jobs-workflows", "audit-log"],
      runtime: { mount: "/billing" },
      permissions: BILLING_SUBSCRIPTION_PERMISSIONS,
      rpc: [
        { method: "startSubscription", scope: "billing.write", public: false },
        { method: "applyStripeEvent", scope: "billing.write", public: false },
      ],
      hooks: [
        { name: "beforeSubscriptionChange", timing: "pre" },
        { name: "onSubscriptionActivated", timing: "post" },
        { name: "onSubscriptionPastDue", timing: "post" },
      ],
      customization: {
        config: ["plans", "trialDays", "usageMeters", "dunning"],
        hooks: ["beforeSubscriptionChange", "onSubscriptionActivated", "onSubscriptionPastDue"],
        forkable: true,
      },
      eventsEmitted: BILLING_SUBSCRIPTION_EVENTS,
      eventsConsumed: [],
    });
  });

  it("exposes inventory reconciliation document and alert APIs in the catalog", () => {
    const module = inspectModule("inventory@0.1.0");
    expect(module.rpc.map((entry) => entry.method)).toEqual(expect.arrayContaining([
      "createReconciliationDocument",
      "listReconciliationDocuments",
      "completeReconciliationDocument",
      "listLowStockAlerts",
    ]));
    expect(module.eventsEmitted).toEqual(expect.arrayContaining([
      "inventory.reconciliation_document_created",
      "inventory.reconciliation_document_completed",
    ]));
    expect(module.surfaces.agentic.tools).toEqual(expect.arrayContaining([
      "inventory.createReconciliationDocument",
      "inventory.completeReconciliationDocument",
      "inventory.listLowStockAlerts",
    ]));
  });

  it("exposes shipment processing transition APIs in the catalog", () => {
    const module = inspectModule("shipment@0.1.0");
    expect(module.rpc.map((entry) => entry.method)).toEqual(expect.arrayContaining([
      "startShipmentProcessing",
      "listShipmentStatusTransitions",
    ]));
    expect(module.eventsEmitted).toEqual(expect.arrayContaining(["shipment.processing_started"]));
    expect(module.surfaces.agentic.tools).toEqual(expect.arrayContaining([
      "shipment.startShipmentProcessing",
      "shipment.listShipmentStatusTransitions",
    ]));
  });

  it("exposes accounting-core financial statement APIs in the catalog", () => {
    const module = inspectModule("accounting-core@0.1.0");
    expect(module.rpc.map((entry) => entry.method)).toEqual(expect.arrayContaining([
      "getIncomeStatement",
      "getBalanceSheet",
      "getCashFlowStatement",
    ]));
    expect(module.surfaces.agentic.tools).toEqual(expect.arrayContaining([
      "accounting-core.getIncomeStatement",
      "accounting-core.getBalanceSheet",
      "accounting-core.getCashFlowStatement",
    ]));
  });

  it("exposes admin, visitor, and agentic surfaces for booking", () => {
    expect(inspectModule("booking@0.1.0").surfaces).toMatchObject({
      admin: {
        applicable: true,
        nav: [{ path: "/bookings", permission: "booking.read" }],
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
      },
      agentic: {
        applicable: true,
        tools: expect.arrayContaining(["booking.getAvailability", "booking.cancelBooking"]),
        approvalRequired: expect.arrayContaining(["booking.createBooking", "booking.cancelBooking"]),
      },
    });
  });

  it("exposes the complete agentic surface for operator work", () => {
    const module = inspectModule("operator-work@0.1.0");

    expect(module).toMatchObject({
      id: "operator-work",
      status: "draft",
      approvalRisk: "medium",
      requires: ["org-team-rbac"],
      runtime: { mount: "/operator-work" },
      permissions: expect.arrayContaining(["operator-work.read", "operator-work.write"]),
      rpc: expect.arrayContaining([
        { method: "getOperatorWorkbench", scope: "operator-work.read", public: false },
        { method: "upsertFocusBlock", scope: "operator-work.write", public: false },
        { method: "saveDailyReview", scope: "operator-work.write", public: false },
      ]),
    });
    expect(module.surfaces.agentic).toMatchObject({
      applicable: true,
      tools: expect.arrayContaining([
        "operator-work.getOperatorWorkbench",
        "operator-work.listFocusBlocks",
        "operator-work.upsertFocusBlock",
        "operator-work.listDailyReviews",
        "operator-work.saveDailyReview",
      ]),
      approvalRequired: expect.arrayContaining([
        "operator-work.upsertOperatorTask",
        "operator-work.upsertFocusBlock",
        "operator-work.saveDailyReview",
      ]),
    });
  });

  it("models Code Memory as approval-gated Trusted Source and Logic Capsule metadata", () => {
    const module = inspectModule("code-memory@0.1.0");

    expect(module).toMatchObject({
      id: "code-memory",
      status: "draft",
      category: "core",
      requires: ["identity"],
      optional: ["audit-log", "jobs-workflows"],
      runtime: { mount: "/code-memory" },
      permissions: expect.arrayContaining(["code-memory.read", "code-memory.approve"]),
      rpc: expect.arrayContaining([
        { method: "addTrustedSource", scope: "code-memory.write", public: false },
        { method: "searchLogicCapsules", scope: "code-memory.read", public: false },
        { method: "approveLogicCapsule", scope: "code-memory.approve", public: false },
      ]),
      eventsEmitted: expect.arrayContaining([
        "code-memory.source.added",
        "code-memory.capsule.approved",
        "code-memory.capsule.retrieved",
      ]),
    });
    expect(module.surfaces.agentic).toMatchObject({
      applicable: true,
      tools: expect.arrayContaining([
        "code-memory.searchLogicCapsules",
        "code-memory.getLogicCapsule",
        "code-memory.approveLogicCapsule",
      ]),
      approvalRequired: expect.arrayContaining([
        "code-memory.addTrustedSource",
        "code-memory.approveLogicCapsule",
      ]),
    });
  });

  it("models Identity as the Code Memory auth/session dependency", () => {
    const module = inspectModule("identity@0.1.0");

    expect(module).toMatchObject({
      id: "identity",
      status: "available",
      category: "platform",
      requires: ["auth"],
      optional: ["email", "audit-log"],
      runtime: { mount: "/identity" },
      permissions: expect.arrayContaining(["identity.login", "identity.session"]),
      rpc: expect.arrayContaining([
        { method: "requestLoginCode", scope: "identity.login", public: false },
        { method: "readSession", scope: "identity.session", public: false },
      ]),
      eventsEmitted: expect.arrayContaining([
        "identity.login_code_issued",
        "identity.session_created",
      ]),
    });
    expect(module.surfaces.agentic).toMatchObject({
      applicable: true,
      tools: expect.arrayContaining([
        "identity.requestLoginCode",
        "identity.readSession",
      ]),
      approvalRequired: expect.arrayContaining([
        "identity.requestLoginCode",
        "identity.destroySession",
      ]),
    });
  });

  it("exposes StackSuite commerce and accounting modules in the static contract catalog", () => {
    expect(listModules().map((module) => module.id)).toEqual(expect.arrayContaining(STACKSUITE_CATALOG_IDS));

    expect(inspectModule("product-catalog@0.1.0")).toMatchObject({
      id: "product-catalog",
      status: "draft",
      category: "core",
      runtime: { mount: "/products" },
      optional: expect.arrayContaining(["auth", "audit-log"]),
      permissions: expect.arrayContaining(["product-catalog.read", "product-catalog.write"]),
      rpc: expect.arrayContaining([
        { method: "listProducts", scope: "product-catalog.read", public: false },
        { method: "createProduct", scope: "product-catalog.write", public: false },
      ]),
      eventsEmitted: expect.arrayContaining([
        "product-catalog.product_created",
        "product-catalog.combo_updated",
      ]),
    });

    expect(inspectModule("sales-order@0.1.0")).toMatchObject({
      id: "sales-order",
      status: "draft",
      optional: expect.arrayContaining(["inventory", "invoice", "email"]),
      rpc: expect.arrayContaining([
        { method: "createDraftOrder", scope: "sales-order.write", public: false },
        { method: "sendSalesOrder", scope: "sales-order.write", public: false },
      ]),
      eventsEmitted: expect.arrayContaining([
        "sales-order.order_sent",
        "sales-order.order_send_failed",
      ]),
      hooks: expect.arrayContaining([expect.objectContaining({ name: "beforeSalesOrderSend" })]),
    });

    expect(inspectModule("accounts-receivable@0.1.0")).toMatchObject({
      id: "accounts-receivable",
      status: "draft",
      requires: ["customer", "invoice"],
      runtime: { mount: "/receivables" },
      eventsEmitted: expect.arrayContaining(["accounts-receivable.payment_applied"]),
    });
    expect(resolveModuleIds(["accounts-receivable@0.1.0"])).toEqual([
      "auth",
      "customer",
      "invoice",
      "accounts-receivable",
    ]);

    expect(inspectModule("estimate-quote@0.1.0")).toMatchObject({
      id: "estimate-quote",
      status: "draft",
      runtime: { mount: "/quotes" },
      optional: expect.arrayContaining(["auth", "audit-log", "invoice"]),
      eventsEmitted: expect.arrayContaining([
        "estimate-quote.accepted",
        "estimate-quote.converted",
      ]),
    });
    expect(inspectModule("recurring-documents@0.1.0")).toMatchObject({
      id: "recurring-documents",
      status: "draft",
      runtime: { mount: "/recurring-documents" },
      optional: expect.arrayContaining(["invoice", "accounts-payable", "jobs-workflows"]),
      eventsEmitted: expect.arrayContaining([
        "recurring-documents.generated",
        "recurring-documents.completed",
      ]),
    });
  });

  it("exposes locked foundation modules in the static contract catalog", () => {
    expect(listModules().map((module) => module.id)).toEqual(expect.arrayContaining(FOUNDATION_CATALOG_IDS));

    expect(inspectModule("org-team-rbac@0.1.0")).toMatchObject({
      id: "org-team-rbac",
      status: "available",
      category: "platform",
      approvalRisk: "high",
      runtime: { mount: "/orgs" },
      permissions: expect.arrayContaining(["org.read", "member.manage"]),
      rpc: expect.arrayContaining([
        { method: "inviteMember", scope: "member.manage", public: false },
        { method: "resolvePermissions", scope: "org.read", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["member.invited", "member.joined"]),
    });

    expect(inspectModule("admin-shell@0.1.0")).toMatchObject({
      id: "admin-shell",
      status: "available",
      category: "platform",
      approvalRisk: "high",
      runtime: { mount: "/admin" },
      permissions: expect.arrayContaining(["admin.access", "admin.write"]),
      rpc: expect.arrayContaining([
        { method: "listRecords", scope: "admin.read", public: false },
        { method: "deleteRecord", scope: "admin.write", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["admin.record_updated"]),
    });

    expect(inspectModule("file-media@0.1.0")).toMatchObject({
      id: "file-media",
      status: "available",
      category: "provider",
      approvalRisk: "high",
      storage: expect.arrayContaining(["d1", "r2"]),
      runtime: { mount: "/files", bindings: expect.arrayContaining(["MEDIA_BUCKET"]) },
      rpc: expect.arrayContaining([
        { method: "createUploadTicket", scope: "media.upload", public: false },
        { method: "deleteFile", scope: "media.admin", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["media.uploaded", "media.ticket_expired"]),
    });

    expect(inspectModule("jobs-workflows@0.1.0")).toMatchObject({
      id: "jobs-workflows",
      status: "available",
      category: "platform",
      approvalRisk: "high",
      storage: expect.arrayContaining(["d1", "queue"]),
      runtime: { mount: "/jobs", bindings: expect.arrayContaining(["JOBS_QUEUE"]) },
      permissions: expect.arrayContaining(["jobs.enqueue", "workflows.run"]),
      rpc: expect.arrayContaining([
        { method: "enqueueJob", scope: "jobs.enqueue", public: false },
        { method: "startWorkflowRun", scope: "workflows.run", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["job.enqueued", "workflow.started"]),
    });

    expect(inspectModule("notifications-inapp@0.1.0")).toMatchObject({
      id: "notifications-inapp",
      status: "available",
      runtime: { mount: "/notifications" },
      permissions: expect.arrayContaining(["notifications.read", "notifications.write"]),
      rpc: expect.arrayContaining([
        { method: "notify", scope: "notifications.write", public: false },
        { method: "getUnreadCount", scope: "notifications.read", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["notification.created", "notification.read"]),
    });

    expect(inspectModule("support-ticket@0.1.0")).toMatchObject({
      id: "support-ticket",
      status: "available",
      runtime: { mount: "/support" },
      permissions: expect.arrayContaining(["support.read", "support.manage"]),
      rpc: expect.arrayContaining([
        { method: "createTicket", scope: "support.manage", public: false },
        { method: "resolveTicketShareToken", scope: "public-token", public: true },
      ]),
      eventsEmitted: expect.arrayContaining([
        "support-ticket.status_changed",
        "support-ticket.share-token.created",
      ]),
    });
  });

  it("exposes every template-locked module in the static contract catalog", () => {
    const catalogIds = listModules().map((module) => module.id);
    expect(catalogIds).toEqual(expect.arrayContaining(LOCKED_TEMPLATE_CATALOG_IDS));

    for (const id of LOCKED_TEMPLATE_CATALOG_IDS) {
      expect(() => inspectModule(`${id}@0.1.0`)).not.toThrow();
    }
  });

  it("exposes remaining locked module metadata in the static contract catalog", () => {
    expect(inspectModule("ads-manager@0.1.0")).toMatchObject({
      id: "ads-manager",
      status: "available",
      category: "provider",
      approvalRisk: "high",
      runtime: { mount: "/ads" },
      secrets: ["ADS_SERVICE_KEY"],
      rpc: expect.arrayContaining([
        { method: "syncInsights", scope: "ads.manage", public: false },
      ]),
      eventsEmitted: expect.arrayContaining(["ad.alert_raised"]),
    });

    expect(inspectModule("forms-intake@0.1.0")).toMatchObject({
      id: "forms-intake",
      status: "available",
      runtime: { mount: "/forms" },
      secrets: ["TURNSTILE_SECRET"],
      rpc: expect.arrayContaining([
        { method: "submitForm", scope: null, public: true },
      ]),
    });

    expect(inspectModule("image-generation@0.1.0")).toMatchObject({
      id: "image-generation",
      status: "available",
      category: "provider",
      approvalRisk: "high",
      storage: expect.arrayContaining(["d1", "r2"]),
      runtime: { mount: "/images", bindings: expect.arrayContaining(["IMAGE_BUCKET"]) },
      secrets: expect.arrayContaining(["OPENAI_API_KEY"]),
      rpc: expect.arrayContaining([
        { method: "generateImage", scope: "image.generate", public: false },
      ]),
    });

    expect(inspectModule("knowledge-base-rag@0.1.0")).toMatchObject({
      id: "knowledge-base-rag",
      status: "draft",
      runtime: { mount: "/knowledge" },
      rpc: expect.arrayContaining([
        { method: "answerQuestion", scope: "knowledge-base-rag.read", public: false },
        { method: "draftSupportReply", scope: "knowledge-base-rag.write", public: false },
      ]),
    });

    expect(inspectModule("marketing-research@0.1.0")).toMatchObject({
      id: "marketing-research",
      status: "available",
      requires: ["org-team-rbac"],
      approvalRisk: "low",
      runtime: { mount: "/marketing-research" },
      rpc: expect.arrayContaining([
        { method: "runResearch", scope: "marketing.run", public: false },
      ]),
    });

    expect(inspectModule("storage-entitlements@0.1.0")).toMatchObject({
      id: "storage-entitlements",
      status: "draft",
      runtime: { mount: "/storage-entitlements" },
      rpc: expect.arrayContaining([
        { method: "resolveShareLink", scope: null, public: true },
      ]),
    });

    expect(inspectModule("support-inbox@0.1.0")).toMatchObject({
      id: "support-inbox",
      status: "draft",
      runtime: { mount: "/support-inbox" },
      permissions: expect.arrayContaining(["support-inbox.agent"]),
      rpc: expect.arrayContaining([
        { method: "startConversation", scope: null, public: true },
      ]),
    });
  });

  it("models Email as an available provider module with current secrets", () => {
    const module = inspectModule("email@0.1.0");

    expect(module).toMatchObject({
      id: "email",
      status: "available",
      category: "provider",
      approvalRisk: "medium",
      optional: expect.arrayContaining(["auth", "audit-log", "customer"]),
      runtime: { mount: "/emails" },
      secrets: ["RESEND_API_KEY", "EMAIL_SERVICE_API_KEY"],
      hooks: expect.arrayContaining([
        expect.objectContaining({ name: "beforeEmailSend", timing: "pre" }),
        expect.objectContaining({ name: "afterEmailQueued", timing: "post" }),
      ]),
      eventsEmitted: ["email.queued", "email.sent", "email.failed"],
    });
    expect(module.surfaces.agentic).toMatchObject({
      applicable: true,
      approvalRequired: ["email.sendEmail"],
    });
  });

  it("records pinned versions in the composition lock", () => {
    const composition = composeApp({ templateId: "booking-business", modules: ["payment@0.1.0"] });
    expect(composition.lock.modules.find((module) => module.id === "payment")).toMatchObject({
      id: "payment",
      version: "0.1.0",
      source: "registry:payment@0.1.0",
      sourceRef: {
        type: "git",
        repo: "microservices-sh/microservices-sh",
        tag: "modules/payment/v0.1.0",
        ref: "refs/tags/modules/payment/v0.1.0",
        path: "modules/payment",
      },
    });
  });

  it("derives deterministic release source refs", () => {
    expect(moduleReleaseTag("auth", "0.1.0")).toBe("modules/auth/v0.1.0");
    expect(moduleSourceRef("auth", "0.1.0")).toMatchObject({
      type: "git",
      url: "https://github.com/microservices-sh/microservices-sh.git",
      tag: "modules/auth/v0.1.0",
      ref: "refs/tags/modules/auth/v0.1.0",
      path: "modules/auth",
    });
  });
});
