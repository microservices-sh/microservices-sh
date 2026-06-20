import { describe, it, expect } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  createInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator,
  listInvoicesScoped,
  getInvoiceScoped,
  issueInvoiceScoped,
  recordPaymentScoped,
  voidInvoiceScoped,
  addLineItemScoped
} from "./index";

// plans/33 — the enforced authorization boundary, proven for invoice. Two tenants
// share one store (one deployment's D1); an actor scoped to org A must never read,
// list, or mutate org B's invoices. This is the CI artifact we show buyers.
const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedDraft(
  invoiceStore: ReturnType<typeof createMemoryInvoiceStore>,
  tenantId: string
) {
  const created = await createInvoice(
    {
      tenantId,
      customerId: "cust-1",
      lineItems: [{ description: "Service", quantity: 1, unitAmountCents: 10_000, taxRateBps: 0 }]
    },
    { invoiceStore, now: fixedNow(T0) }
  );
  if (!created.ok) throw new Error("seed failed");
  return created.data.id as string;
}

describe("invoice: enforced tenant boundary (cross-tenant leak test)", () => {
  it("an actor scoped to org A can never read, list, or mutate org B's invoices", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();
    const deps = { invoiceStore, allocator, now: fixedNow(T0) };
    const ctxA = authContext({ orgId: "tenant-1", actorId: "user-a" });

    const a1 = await seedDraft(invoiceStore, "tenant-1");
    await seedDraft(invoiceStore, "tenant-1");
    const b1 = await seedDraft(invoiceStore, "tenant-2");

    // LIST as A returns only A's invoices — even when a forged tenantId is passed.
    const listed = await listInvoicesScoped(ctxA, { tenantId: "tenant-2" }, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(2);
      expect(listed.data.invoices.every((i) => i.tenantId === "tenant-1")).toBe(true);
    }

    // GET: A's own invoice resolves; B's id is reported not-found (no disclosure).
    const ownGet = await getInvoiceScoped(ctxA, a1, deps);
    expect(ownGet.ok).toBe(true);
    const foreignGet = await getInvoiceScoped(ctxA, b1, deps);
    expect(foreignGet.ok).toBe(false);
    expect(foreignGet.status).toBe(404);

    // MUTATE: every id-taking write against B's invoice is refused with 404.
    const fIssue = await issueInvoiceScoped(ctxA, { invoiceId: b1 }, deps);
    expect(fIssue.ok).toBe(false);
    expect(fIssue.status).toBe(404);

    const fEdit = await addLineItemScoped(
      ctxA,
      b1,
      { description: "Extra", quantity: 1, unitAmountCents: 500, taxRateBps: 0 },
      deps
    );
    expect(fEdit.ok).toBe(false);
    expect(fEdit.status).toBe(404);

    const fPay = await recordPaymentScoped(ctxA, { invoiceId: b1, amountCents: 100 }, deps);
    expect(fPay.ok).toBe(false);
    expect(fPay.status).toBe(404);

    const fVoid = await voidInvoiceScoped(ctxA, b1, deps);
    expect(fVoid.ok).toBe(false);
    expect(fVoid.status).toBe(404);

    // B's invoice is untouched: still a draft, no line items added by A.
    const bStillGet = await getInvoiceScoped(authContext({ orgId: "tenant-2", actorId: "user-b" }), b1, deps);
    expect(bStillGet.ok).toBe(true);
    if (bStillGet.ok) {
      expect(bStillGet.data.invoice.status).toBe("draft");
      expect(bStillGet.data.lineItems.length).toBe(1);
    }

    // A own-tenant mutation still works (the boundary doesn't block legitimate use).
    const okIssue = await issueInvoiceScoped(ctxA, { invoiceId: a1 }, deps);
    expect(okIssue.ok).toBe(true);

    // A call lacking an org scope is refused (403), not run unscoped.
    const noScope = await listInvoicesScoped(
      { orgId: "", actorId: "x", roles: [] } as unknown as AuthContext,
      {},
      deps
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);
  });
});
