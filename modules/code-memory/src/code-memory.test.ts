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

  it("recognizes StackSuite accounting and invoice port candidates", async () => {
    const suggestions = suggestLogicCapsulesFromFiles({
      sourceId: "cmsrc_stacksuite",
      ref: "local",
      files: [
        {
          path: "src/lib/db/queries/journal-entries.ts",
          content: "createJournalEntry requires debit and credit lines to be balanced before posting to the fiscal ledger and trial balance."
        },
        {
          path: "src/lib/db/queries/bank-reconciliations.ts",
          content: "import bank statement csv transactions, match cleared ledger records, reconcile ending balance, and keep unresolved differences open."
        },
        {
          path: "src/lib/db/queries/recurring-bills.ts",
          content: "generateDueRecurringBills from a recurring bill template using frequency, schedule, and nextRunAt idempotency."
        },
        {
          path: "src/lib/integrations/woocommerce-webhooks.ts",
          content: "Verify WooCommerce webhook signature, process WCOrder WCCustomer WCProduct payloads, and sync externalSource records."
        },
        {
          path: "src/lib/db/queries/inventory.ts",
          content: "Reserve stock for shipment batches, compute onHand available balances, record invoice_reserved stockMovements, and release reservations."
        },
        {
          path: "src/lib/utils/print-invoice.ts",
          content: "generateInvoiceHTML returns a printable document with escapeHtml, filename helpers, download metadata, and html2pdf support."
        },
        {
          path: "tests/accounting/journal-entries.test.ts",
          content: "rejects unbalanced debit and credit journal entries"
        },
        {
          path: "tests/banking/reconciliation.test.ts",
          content: "keeps bank reconciliation open when statement difference remains"
        },
        {
          path: "tests/integrations/woocommerce-webhooks.test.ts",
          content: "rejects invalid WooCommerce webhook signatures"
        },
        {
          path: "tests/printing/print-invoice.test.ts",
          content: "escapes invoice customer text before rendering printable HTML"
        }
      ],
      maxCandidates: 10
    });

    expect(suggestions.scanSummary).toMatchObject({
      fileCount: 10,
      candidateCount: 6,
      heuristics: [
        "accounting-journal-posting",
        "bank-reconciliation-workflow",
        "recurring-invoice-generator",
        "woocommerce-sync-adapter",
        "shipment-inventory-reservation",
        "printable-document-renderer"
      ]
    });
    expect(suggestions.candidates.map((candidate) => candidate.reuseMode)).toEqual(["module", "module", "adapt", "adapt", "module", "adapt"]);
    expect(suggestions.candidates.find((candidate) => candidate.slug === "accounting-journal-posting")?.tests).toEqual(["tests/accounting/journal-entries.test.ts"]);
    expect(suggestions.candidates.find((candidate) => candidate.slug === "woocommerce-sync-adapter")?.tests).toEqual(["tests/integrations/woocommerce-webhooks.test.ts"]);
    expect(suggestions.candidates.find((candidate) => candidate.slug === "printable-document-renderer")?.constraints).toContain(
      "Never render unescaped customer or line-item text into HTML."
    );
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
