import { describe, expect, it } from "vitest";
import { checkUpdates, getModuleDoc, planAddModule, planModuleUpgrade } from "../src/index.js";

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
});
