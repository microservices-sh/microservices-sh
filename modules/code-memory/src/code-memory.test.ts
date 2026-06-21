import { describe, expect, it } from "vitest";
import { createCodeMemoryMemoryStore } from "./adapters/memory";
import { suggestLogicCapsulesFromFiles } from "./scanner";
import { createCodeMemoryService, createSequentialCodeMemoryIdFactory } from "./service";
import { createCodeMemoryToolHandlers } from "./tools";
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

  it("suggests scanner candidates from static file hints without executing repo code", async () => {
    const memory = service();
    const { source } = unwrap(await memory.addTrustedSource(ctx, { repoUrl: "https://github.com/acme/ops-kit" }));
    const suggestions = suggestLogicCapsulesFromFiles({
      sourceId: source.id,
      ref: "main",
      commitSha: "def456",
      files: [
        {
          path: "src/billing/stripe-webhooks.ts",
          content: "stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)"
        },
        {
          path: "src/billing/invoice-numbering.ts",
          content: "async function nextInvoiceNumber(tenantId) { return reserveInvoiceSequence(tenantId); }"
        },
        {
          path: "src/booking/availability.ts",
          content: "export function hasBookingOverlap(slot, bookings) { return bookings.some((booking) => conflicts(slot, booking)); }"
        },
        {
          path: "test/billing/stripe-webhooks.test.ts",
          content: "rejects webhook payloads when the stripe signature is invalid"
        },
        {
          path: "test/booking/availability.test.ts",
          content: "allows adjacent slots and rejects overlapping bookings"
        }
      ],
      maxCandidates: 5
    });

    expect(suggestions.scanSummary).toMatchObject({
      fileCount: 5,
      candidateCount: 3,
      truncated: false,
      heuristics: ["stripe-webhook-verifier", "invoice-numbering", "booking-overlap-checker"]
    });

    const scan = unwrap(
      await memory.recordSourceScan(ctx, {
        sourceId: source.id,
        ref: "main",
        commitSha: "def456",
        scanSummary: suggestions.scanSummary,
        candidates: suggestions.candidates
      })
    );

    expect(scan.candidates.map((candidate) => candidate.slug)).toEqual(["stripe-webhook-verifier", "invoice-numbering", "booking-overlap-checker"]);
    expect(scan.candidates[0]?.tests).toEqual(["test/billing/stripe-webhooks.test.ts"]);
    expect(scan.candidates[2]?.tests).toEqual(["test/booking/availability.test.ts"]);
  });

  it("adapts service methods to governed tool handler names", async () => {
    const memory = service();
    const handlers = createCodeMemoryToolHandlers({ service: memory });
    const toolCtx = { tenantId: "tenant_1", actor: "agent:builder", now: "2026-01-01T00:00:00.000Z" };

    const added = await handlers["code-memory_addTrustedSource"]({ repoUrl: "https://github.com/acme/auth-kit" }, toolCtx) as { source: { id: string } };
    await handlers["code-memory_recordSourceScan"](
      {
        sourceId: added.source.id,
        candidates: [
          {
            sourceId: added.source.id,
            name: "Stripe webhook verifier",
            purpose: "Verify Stripe webhook signatures before parsing request JSON.",
            sourcePath: "src/billing/webhooks.ts",
            files: ["src/billing/webhooks.ts"]
          }
        ]
      },
      toolCtx
    );

    const beforeApproval = await handlers["code-memory_searchLogicCapsules"]({ query: "stripe" }, toolCtx) as { capsules: unknown[] };
    expect(beforeApproval.capsules).toEqual([]);

    const approved = await handlers["code-memory_approveLogicCapsule"]({ idOrSlug: "stripe-webhook-verifier" }, toolCtx) as { capsule: { approvalStatus: string } };
    expect(approved.capsule.approvalStatus).toBe("approved");

    const found = await handlers["code-memory_searchLogicCapsules"]({ query: "stripe" }, toolCtx) as { capsules: Array<{ slug: string }> };
    expect(found.capsules.map((capsule) => capsule.slug)).toEqual(["stripe-webhook-verifier"]);
  });
});
