import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  moduleReleaseTagPlan,
  moduleReleaseTagReport,
  normalizeInteractiveMetadata,
  normalizeLocalizationMetadata,
  normalizeManifestConnections,
  normalizeRuntimeMetadata,
  normalizeSkillMetadata,
  normalizeSurfaceMetadata,
  normalizeUiTemplateMetadata
} from "../src/index.js";

describe("normalizeManifestConnections", () => {
  it("reads the nested connections block when present", () => {
    const n = normalizeManifestConnections({
      connections: {
        requires: ["auth"],
        optional: ["audit-log"],
        events: { emits: ["payment.succeeded"], consumes: ["booking.created"] },
        hookPoints: { beforeCreate: { kind: "filter" } },
        rpc: { exposes: [{ method: "createPaymentIntent" }], calls: [{ target: "auth.verifyToken" }] }
      }
    });
    expect(n.requires).toEqual(["auth"]);
    expect(n.optional).toEqual(["audit-log"]);
    expect(n.emits).toEqual(["payment.succeeded"]);
    expect(n.consumes).toEqual(["booking.created"]);
    expect(n.events).toEqual(["payment.succeeded", "booking.created"]);
    expect(n.hooks).toEqual(["beforeCreate"]);
    expect(n.rpc.exposes).toHaveLength(1);
    expect(n.rpc.calls).toHaveLength(1);
  });

  it("ignores legacy flat fields (fallbacks removed in phase 3)", () => {
    const n = normalizeManifestConnections({
      requires: ["auth"],
      events: ["payment.succeeded"],
      eventsConsumed: ["booking.created"],
      hooks: ["beforeCreate"],
      rpc: [{ method: "createPaymentIntent" }]
    });
    // flat fields are no longer read — only `connections` counts
    expect(n.requires).toEqual([]);
    expect(n.events).toEqual([]);
    expect(n.hooks).toEqual([]);
    expect(n.rpc.exposes).toEqual([]);
  });

  it("defaults everything to empty when neither shape present", () => {
    const n = normalizeManifestConnections({});
    expect(n).toEqual({
      requires: [], optional: [], emits: [], consumes: [], events: [], hooks: [],
      rpc: { exposes: [], calls: [] }
    });
  });
});

describe("setup metadata normalizers", () => {
  it("keeps supported interactive setup metadata", () => {
    const n = normalizeInteractiveMetadata({
      schema: "setup.schema.json",
      command: "pnpm microservices setup email",
      mode: "module-setup",
      stores: { secrets: "runtime-secret-store" },
      ignored: true
    });

    expect(n).toEqual({
      schema: "setup.schema.json",
      command: "pnpm microservices setup email",
      mode: "module-setup",
      stores: { secrets: "runtime-secret-store" }
    });
  });

  it("normalizes skill ids and richer skill metadata", () => {
    const n = normalizeSkillMetadata([
      "company-web-design",
      { id: "email-service-setup", recommendedFor: ["provider-setup", "sender-domain"], path: "skills/email/SKILL.md" },
      { id: "Invalid Skill", recommendedFor: ["ignored"] },
      null
    ]);

    expect(n).toEqual([
      { id: "company-web-design", recommendedFor: [] },
      { id: "email-service-setup", recommendedFor: ["provider-setup", "sender-domain"], path: "skills/email/SKILL.md" }
    ]);
  });

  it("normalizes admin, visitor, and agentic surface metadata", () => {
    const n = normalizeSurfaceMetadata({
      admin: {
        nav: [{ label: "Bookings", path: "/bookings", permission: "booking.read" }],
        referenceUi: ["reference-ui/admin/README.md", "../bad"]
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
        referenceUi: ["reference-ui/visitor/README.md"]
      },
      agentic: {
        mcpTools: ["booking.list", ""],
        skillPaths: ["skills/booking-operator/SKILL.md"],
        approvalRequiredFor: ["booking.cancel"]
      }
    });

    expect(n).toEqual({
      admin: {
        applicable: true,
        nav: [{ label: "Bookings", path: "/bookings", permission: "booking.read" }],
        referenceUi: ["reference-ui/admin/README.md"]
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
        referenceUi: ["reference-ui/visitor/README.md"]
      },
      agentic: {
        applicable: true,
        tools: ["booking.list"],
        skillPaths: ["skills/booking-operator/SKILL.md"],
        approvalRequired: ["booking.cancel"]
      }
    });
  });

  it("normalizes runtime language metadata from one or more languages", () => {
    expect(normalizeRuntimeMetadata({ language: "typescript", platform: "cloudflare-workers" })).toEqual({
      language: "typescript",
      platform: "cloudflare-workers",
      languages: ["typescript"]
    });

    expect(normalizeRuntimeMetadata({ languages: ["typescript", "svelte", "typescript"], language: "typescript" })).toEqual({
      languages: ["typescript", "svelte"],
      language: "typescript"
    });
  });

  it("normalizes localization metadata without assuming a single locale", () => {
    expect(normalizeLocalizationMetadata({
      defaultLanguage: "en",
      languages: ["en", "zh-TW", "en"],
      strategy: "url",
      notes: ["host-owned"]
    })).toEqual({
      defaultLanguage: "en",
      languages: ["en", "zh-TW"],
      strategy: "url",
      notes: ["host-owned"]
    });
  });

  it("normalizes UI template metadata", () => {
    expect(normalizeUiTemplateMetadata({
      package: "@microservices-sh/ui",
      style: "web-portal",
      target: "src/lib/ui",
      registry: "packages/ui/registry.json",
      installCommand: "msh-ui add Button",
      components: ["Button", "Card"],
      surfaces: ["dashboard"]
    })).toEqual({
      package: "@microservices-sh/ui",
      style: "web-portal",
      target: "src/lib/ui",
      registry: "packages/ui/registry.json",
      installCommand: "msh-ui add Button",
      components: ["Button", "Card"],
      surfaces: ["dashboard"]
    });
  });
});

describe("checked-in module surface metadata", () => {
  it("declares admin, visitor, and agentic lanes for every module manifest", () => {
    const modulesRoot = new URL("../../../modules/", import.meta.url);
    const missing = [];

    for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = new URL(`${entry.name}/module.json`, modulesRoot);
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const surfaces = normalizeSurfaceMetadata(manifest.surfaces);
      if (!surfaces?.admin || !surfaces?.visitor || !surfaces?.agentic) {
        missing.push(manifest.id ?? entry.name);
      }
    }

    expect(missing).toEqual([]);
  });
});

describe("checked-in UI template metadata", () => {
  it("declares package UI templates with flexible language metadata", () => {
    const packagesRoot = new URL("../../../packages/", import.meta.url);
    const found = [];

    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = new URL(`${entry.name}/microservices.ui-template.json`, packagesRoot);
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      found.push(manifest.id);
      expect(manifest.kind).toBe("ui");
      expect(normalizeRuntimeMetadata(manifest.runtime).languages.length).toBeGreaterThan(0);
      expect(normalizeLocalizationMetadata(manifest.localization)?.languages.length).toBeGreaterThan(0);
      expect(normalizeUiTemplateMetadata(manifest.ui)?.components.length).toBeGreaterThan(0);
    }

    expect(found.sort()).toEqual(["module-reference-ui-svelte", "ui-web-portal-svelte"]);
  });
});

describe("moduleReleaseTagReport", () => {
  const modules = [
    {
      id: "auth",
      version: "0.1.0",
      status: "available",
      path: "modules/auth",
      sourceRef: {
        tag: "modules/auth/v0.1.0",
        ref: "refs/tags/modules/auth/v0.1.0"
      }
    },
    {
      id: "payment",
      version: "0.1.0",
      status: "available",
      path: "modules/payment"
    },
    {
      id: "draft-module",
      version: "0.1.0",
      status: "draft",
      path: "modules/draft-module"
    }
  ];

  it("passes when every available module has a release tag", () => {
    const report = moduleReleaseTagReport(modules, [
      "refs/tags/modules/auth/v0.1.0",
      "modules/payment/v0.1.0"
    ]);

    expect(report.status).toBe("pass");
    expect(report.checked).toBe(2);
    expect(report.present).toBe(2);
    expect(report.missingTags).toEqual([]);
    expect(report.required.map((item) => item.tag)).toEqual([
      "modules/auth/v0.1.0",
      "modules/payment/v0.1.0"
    ]);
  });

  it("reports missing tags for available modules", () => {
    const report = moduleReleaseTagReport(modules, ["modules/auth/v0.1.0"]);

    expect(report.status).toBe("fail");
    expect(report.checked).toBe(2);
    expect(report.present).toBe(1);
    expect(report.missing).toBe(1);
    expect(report.missingTags).toEqual([
      {
        id: "payment",
        version: "0.1.0",
        path: "modules/payment",
        tag: "modules/payment/v0.1.0",
        ref: "refs/tags/modules/payment/v0.1.0",
        present: false
      }
    ]);
  });

  it("plans create commands only for missing available-module tags", () => {
    const plan = moduleReleaseTagPlan(modules, ["modules/auth/v0.1.0"], "abc123");

    expect(plan.status).toBe("pending");
    expect(plan.checked).toBe(2);
    expect(plan.existing).toBe(1);
    expect(plan.create).toBe(1);
    expect(plan.tags.existing.map((item) => item.tag)).toEqual(["modules/auth/v0.1.0"]);
    expect(plan.tags.create).toEqual([
      {
        id: "payment",
        version: "0.1.0",
        path: "modules/payment",
        tag: "modules/payment/v0.1.0",
        ref: "refs/tags/modules/payment/v0.1.0",
        present: false,
        targetRef: "abc123",
        command: "git tag modules/payment/v0.1.0 abc123"
      }
    ]);
  });
});
