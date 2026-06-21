import { describe, expect, it } from "vitest";
import { createCodeMemoryMemoryStore } from "./adapters/memory";
import { createCodeMemoryService, createSequentialCodeMemoryIdFactory } from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createCodeMemoryService({
    store: createCodeMemoryMemoryStore(),
    createId: createSequentialCodeMemoryIdFactory()
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

describe("code-memory service", () => {
  it("adds Trusted Sources from GitHub URLs and preserves path/ref metadata", async () => {
    const memory = service();
    const result = unwrap(
      await memory.addTrustedSource(ctx, {
        repoUrl: "https://github.com/Acme/auth-kit/tree/main/src/auth",
        repoVisibility: "public"
      })
    );

    expect(result.source).toMatchObject({
      id: "cmsrc_000001",
      provider: "github",
      repoUrl: "https://github.com/Acme/auth-kit",
      repoOwner: "Acme",
      repoName: "auth-kit",
      repoVisibility: "public",
      defaultBranch: "main",
      allowedPaths: ["src/auth"],
      scanStatus: "not_scanned"
    });

    const sources = unwrap(await memory.listTrustedSources(ctx));
    expect(sources.sources).toHaveLength(1);
  });

  it("records scans, creates candidate capsules, and searches only approved capsules by default", async () => {
    const memory = service();
    const { source } = unwrap(await memory.addTrustedSource(ctx, { repoUrl: "https://github.com/acme/auth-kit" }));

    const scan = unwrap(
      await memory.recordSourceScan(ctx, {
        sourceId: source.id,
        ref: "main",
        commitSha: "abc123",
        scanSummary: { fileCount: 4, truncated: false },
        candidates: [
          {
            sourceId: source.id,
            name: "Stripe webhook verifier",
            purpose: "Verify Stripe webhook signatures before parsing request JSON.",
            sourcePath: "src/billing/webhooks.ts",
            files: ["src/billing/webhooks.ts"],
            tests: ["test/billing/webhooks.test.ts"],
            dependencies: ["stripe"],
            requiredEnv: ["STRIPE_WEBHOOK_SECRET"],
            constraints: ["Do not parse JSON before signature verification."]
          }
        ]
      })
    );

    expect(scan.scanned).toMatchObject({ ref: "main", fileCount: 4, candidateCount: 1, truncated: false });
    expect(scan.source.scanStatus).toBe("scanned");
    expect(scan.candidates[0]?.approvalStatus).toBe("candidate");

    const beforeApproval = unwrap(await memory.searchLogicCapsules(ctx, { query: "stripe" }));
    expect(beforeApproval.capsules).toEqual([]);

    const approved = unwrap(await memory.approveLogicCapsule(ctx, "stripe-webhook-verifier"));
    expect(approved.capsule.approvalStatus).toBe("approved");

    const search = unwrap(await memory.searchLogicCapsules(ctx, { query: "webhook" }));
    expect(search.capsules.map((capsule) => capsule.slug)).toEqual(["stripe-webhook-verifier"]);

    const capsule = unwrap(await memory.getLogicCapsule(ctx, "stripe-webhook-verifier")).capsule;
    expect(capsule.provenance).toMatchObject({
      repoUrl: "https://github.com/acme/auth-kit",
      path: "src/billing/webhooks.ts",
      ref: "main",
      commitSha: "abc123"
    });
  });

  it("rejects capsules so they no longer appear in approved search", async () => {
    const memory = service();
    const { source } = unwrap(await memory.addTrustedSource(ctx, { repoUrl: "https://github.com/acme/auth-kit" }));
    const { capsule } = unwrap(
      await memory.createLogicCapsule(ctx, {
        sourceId: source.id,
        name: "Invoice numbering",
        purpose: "Allocate invoice numbers without duplicates.",
        approvalStatus: "approved"
      })
    );

    expect(unwrap(await memory.searchLogicCapsules(ctx, { query: "invoice" })).capsules).toHaveLength(1);
    unwrap(await memory.rejectLogicCapsule(ctx, capsule.slug));
    expect(unwrap(await memory.searchLogicCapsules(ctx, { query: "invoice" })).capsules).toEqual([]);
  });
});
