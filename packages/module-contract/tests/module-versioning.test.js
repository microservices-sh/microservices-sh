import { describe, expect, it } from "vitest";
import { composeApp, inspectModule, moduleReleaseTag, moduleSourceRef, parseModuleRef, resolveModuleIds } from "../src/index.js";

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
