import { describe, expect, it } from "vitest";
import { composeApp, inspectModule, listModules, moduleReleaseTag, moduleSourceRef, parseModuleRef, resolveModuleIds } from "../src/index.js";

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
