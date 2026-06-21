import { describe, expect, it } from "vitest";
import {
  checkUpdates,
  getModuleDoc,
  getSecretsStatus,
  listModuleDocs,
  planAddModule,
  planModuleUpgrade,
} from "../src/index.js";

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

function lockWith(module) {
  return {
    schemaVersion: "2026-06-13",
    modules: [
      {
        id: module.id,
        version: module.version,
        source: `registry:${module.id}@${module.version}`,
        checksum: `sha256:${module.id}`,
        sourceRef: {
          type: "git",
          repo: "microservices-sh/microservices-sh",
          url: "https://github.com/microservices-sh/microservices-sh.git",
          tag: `modules/${module.id}/v${module.version}`,
          ref: `refs/tags/modules/${module.id}/v${module.version}`,
          path: `modules/${module.id}`,
        },
        contract: {
          mount: "/auth",
          resources: ["D1"],
          permissions: ["auth.verify"],
          hooks: [],
          events: [],
          requires: [],
          secrets: [],
        },
      },
    ],
    customizations: { config: true, hooks: [], overlays: [], forks: [] },
  };
}

describe("SDK module version planning", () => {
  it("plans add for an exact requested version", () => {
    const response = planAddModule({ moduleId: "auth@0.1.0" });
    expect(response.ok).toBe(true);
    expect(response.data.module.id).toBe("auth");
    expect(response.data.requestedVersion).toBe("0.1.0");
    expect(response.data.lockEntry.source).toBe("registry:auth@0.1.0");
    expect(response.data.sourceRef).toMatchObject({
      tag: "modules/auth/v0.1.0",
      ref: "refs/tags/modules/auth/v0.1.0",
      path: "modules/auth",
    });
    expect(response.data.lockEntry.sourceRef).toMatchObject({
      tag: "modules/auth/v0.1.0",
    });
  });

  it("rejects add for unavailable versions", () => {
    const response = planAddModule({ moduleId: "auth@9.9.9" });
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe("MODULE_VERSION_NOT_FOUND");
    expect(response.error.details.availableVersions).toContain("0.1.0");
  });

  it("approval-gates generated SaaS subscription billing", () => {
    const response = planAddModule({ moduleId: "billing-subscriptions@0.1.0", installedModules: [] });
    expect(response.ok).toBe(true);
    expect(response.data.module.id).toBe("billing-subscriptions");
    expect(response.data.module.approvalRisk).toBe("high");
    expect(response.data.approvalRequired).toBe(true);
    expect(response.data.missingDependencies).toEqual([]);
  });

  it("plans a downgrade when the lockfile is ahead of the requested registry target", () => {
    const response = planModuleUpgrade({
      moduleId: "auth",
      targetVersion: "0.1.0",
      lock: lockWith({ id: "auth", version: "0.2.0" }),
    });
    expect(response.ok).toBe(true);
    expect(response.data.action).toBe("downgrade-plan");
    expect(response.data.direction).toBe("downgrade");
    expect(response.data.module.currentVersion).toBe("0.2.0");
    expect(response.data.module.targetVersion).toBe("0.1.0");
    expect(response.data.lockfile.sourceRef).toMatchObject({
      tag: "modules/auth/v0.2.0",
    });
    expect(response.data.lockfile.targetSourceRef).toMatchObject({
      tag: "modules/auth/v0.1.0",
    });
  });

  it("returns no-op when the installed version matches the target", () => {
    const response = planModuleUpgrade({
      moduleId: "auth@0.1.0",
      lock: lockWith({ id: "auth", version: "0.1.0" }),
    });
    expect(response.ok).toBe(true);
    expect(response.data.action).toBe("no-op");
    expect(response.data.direction).toBe("none");
  });

  it("reports update direction from a supplied lockfile", () => {
    const response = checkUpdates({ lock: lockWith({ id: "auth", version: "0.2.0" }) });
    expect(response.ok).toBe(true);
    expect(response.data.current[0]).toMatchObject({
      id: "auth",
      currentVersion: "0.2.0",
      latestVersion: "0.1.0",
      direction: "downgrade",
      status: "update-available",
    });
  });

  it("resolves docs for exact module versions", () => {
    const response = getModuleDoc("auth@0.1.0");
    expect(response.ok).toBe(true);
    expect(response.data.module.sourceRef).toMatchObject({
      tag: "modules/auth/v0.1.0",
    });
  });

  it("includes operator work agentic tools in generated docs", () => {
    const response = getModuleDoc("operator-work@0.1.0");
    expect(response.ok).toBe(true);
    expect(response.data.module.id).toBe("operator-work");
    expect(response.data.module.requires).toEqual(["org-team-rbac"]);
    expect(response.data.module.surfaces.agentic.tools).toEqual(
      expect.arrayContaining([
        "operator-work.getOperatorWorkbench",
        "operator-work.listFocusBlocks",
        "operator-work.upsertFocusBlock",
        "operator-work.saveDailyReview",
      ])
    );
    expect(response.data.markdown).toContain("operator-work.getOperatorWorkbench");
    expect(response.data.markdown).toContain("operator-work.saveDailyReview");
  });

  it("generates Email docs from the available contract metadata", () => {
    const docs = listModuleDocs();
    expect(docs.ok).toBe(true);

    const emailDocs = docs.data.filter((module) => module.id === "email");
    expect(emailDocs).toHaveLength(1);
    expect(emailDocs[0]).toMatchObject({
      status: "available",
      approvalRisk: "medium",
      docPath: "docs/modules/email.md",
    });

    const response = getModuleDoc("email@0.1.0");
    expect(response.ok).toBe(true);
    expect(response.data.module).toMatchObject({
      id: "email",
      status: "available",
      secrets: ["RESEND_API_KEY", "EMAIL_SERVICE_API_KEY"],
      resources: ["D1"],
      hooks: ["beforeEmailSend", "afterEmailQueued", "afterEmailFailed"],
      events: ["email.queued", "email.sent", "email.failed"],
    });
    expect(response.data.markdown).toContain("Status: available");
    expect(response.data.markdown).toContain("RESEND_API_KEY");
    expect(response.data.markdown).not.toContain("EMAIL_PROVIDER_API_KEY");

    const plan = planAddModule({ moduleId: "email@0.1.0", installedModules: [] });
    expect(plan.ok).toBe(true);
    expect(plan.data.action).toBe("install");
    expect(plan.data.requiredSecrets).toEqual(["RESEND_API_KEY", "EMAIL_SERVICE_API_KEY"]);

    const secrets = getSecretsStatus({ installedModules: ["email"] });
    expect(secrets.ok).toBe(true);
    expect(secrets.data.secrets.filter((secret) => secret.module === "email").map((secret) => secret.name)).toEqual([
      "RESEND_API_KEY",
      "EMAIL_SERVICE_API_KEY",
    ]);
  });

  it("includes StackSuite commerce and accounting modules in generated docs", () => {
    const docs = listModuleDocs();
    expect(docs.ok).toBe(true);
    expect(docs.data.map((module) => module.id)).toEqual(
      expect.arrayContaining([
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
      ])
    );

    const productCatalog = getModuleDoc("product-catalog@0.1.0");
    expect(productCatalog.ok).toBe(true);
    expect(productCatalog.data.module).toMatchObject({
      id: "product-catalog",
      status: "draft",
      mount: "/products",
      events: expect.arrayContaining([
        "product-catalog.product_created",
        "product-catalog.combo_updated",
      ]),
    });

    const recurringDocuments = getModuleDoc("recurring-documents@0.1.0");
    expect(recurringDocuments.ok).toBe(true);
    expect(recurringDocuments.data.module).toMatchObject({
      id: "recurring-documents",
      status: "draft",
      mount: "/recurring-documents",
      events: expect.arrayContaining(["recurring-documents.generated"]),
    });

    const receivables = planAddModule({
      moduleId: "accounts-receivable@0.1.0",
      installedModules: ["auth", "customer"],
    });
    expect(receivables.ok).toBe(true);
    expect(receivables.data.missingDependencies).toEqual(["invoice"]);
  });

  it("includes locked foundation modules in generated docs", () => {
    const docs = listModuleDocs();
    expect(docs.ok).toBe(true);
    expect(docs.data.map((module) => module.id)).toEqual(expect.arrayContaining(FOUNDATION_CATALOG_IDS));

    const orgTeamRbac = getModuleDoc("org-team-rbac@0.1.0");
    expect(orgTeamRbac.ok).toBe(true);
    expect(orgTeamRbac.data.module).toMatchObject({
      id: "org-team-rbac",
      status: "available",
      mount: "/orgs",
      approvalRisk: "high",
      docPath: "docs/modules/org-team-rbac.md",
      events: expect.arrayContaining(["member.invited", "member.joined"]),
    });
    expect(orgTeamRbac.data.markdown).toContain("org-team-rbac.resolvePermissions");

    const fileMedia = getModuleDoc("file-media@0.1.0");
    expect(fileMedia.ok).toBe(true);
    expect(fileMedia.data.module).toMatchObject({
      id: "file-media",
      mount: "/files",
      approvalRisk: "high",
      resources: expect.arrayContaining(["D1", "R2"]),
      rpc: expect.arrayContaining([
        { method: "createUploadTicket", scope: "media.upload", public: false },
        { method: "deleteFile", scope: "media.admin", public: false },
      ]),
    });
    expect(fileMedia.data.markdown).toContain("- R2");
    expect(fileMedia.data.markdown).toContain("file-media.createUploadTicket");

    const jobsWorkflows = getModuleDoc("jobs-workflows@0.1.0");
    expect(jobsWorkflows.ok).toBe(true);
    expect(jobsWorkflows.data.module).toMatchObject({
      id: "jobs-workflows",
      mount: "/jobs",
      approvalRisk: "high",
      permissions: expect.arrayContaining(["jobs.enqueue", "workflows.run"]),
      events: expect.arrayContaining(["workflow.started", "workflow.artifact.recorded"]),
    });
    expect(jobsWorkflows.data.markdown).toContain("jobs-workflows.startWorkflowRun");

    const supportTicket = getModuleDoc("support-ticket@0.1.0");
    expect(supportTicket.ok).toBe(true);
    expect(supportTicket.data.module).toMatchObject({
      id: "support-ticket",
      mount: "/support",
      docPath: "docs/modules/support-ticket.md",
      rpc: expect.arrayContaining([
        { method: "resolveTicketShareToken", scope: "public-token", public: true },
      ]),
    });
    expect(supportTicket.data.markdown).toContain("support-ticket.resolveTicketShareToken");
  });

  it("includes every template-locked module in generated docs", () => {
    const docs = listModuleDocs();
    expect(docs.ok).toBe(true);
    expect(docs.data.map((module) => module.id)).toEqual(expect.arrayContaining(LOCKED_TEMPLATE_CATALOG_IDS));

    const adsManager = getModuleDoc("ads-manager@0.1.0");
    expect(adsManager.ok).toBe(true);
    expect(adsManager.data.module).toMatchObject({
      id: "ads-manager",
      mount: "/ads",
      approvalRisk: "high",
      secrets: ["ADS_SERVICE_KEY"],
    });
    expect(adsManager.data.markdown).toContain("ads-manager.syncInsights");

    const imageGeneration = getModuleDoc("image-generation@0.1.0");
    expect(imageGeneration.ok).toBe(true);
    expect(imageGeneration.data.module).toMatchObject({
      id: "image-generation",
      mount: "/images",
      resources: expect.arrayContaining(["D1", "R2"]),
      secrets: expect.arrayContaining(["OPENAI_API_KEY"]),
    });
    expect(imageGeneration.data.markdown).toContain("image-generation.generateImage");

    const storageEntitlements = getModuleDoc("storage-entitlements@0.1.0");
    expect(storageEntitlements.ok).toBe(true);
    expect(storageEntitlements.data.module).toMatchObject({
      id: "storage-entitlements",
      mount: "/storage-entitlements",
    });
    expect(storageEntitlements.data.markdown).toContain("storage-entitlements.resolveShareLink");

    const supportInbox = getModuleDoc("support-inbox@0.1.0");
    expect(supportInbox.ok).toBe(true);
    expect(supportInbox.data.module).toMatchObject({
      id: "support-inbox",
      mount: "/support-inbox",
    });
    expect(supportInbox.data.markdown).toContain("support-inbox.startConversation");
  });
});
