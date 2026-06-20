import { describe, it, expect } from "vitest";
// Imported by relative path on purpose: this proof runs against the REAL shipped
// module source, not a mock. (Relative because the proof dir isn't a workspace
// package — it adds zero dependencies.)
import {
  createInvoice,
  createMemoryInvoiceStore,
  // the raw, input-trusting use-case an AI agent reaches for first:
  listInvoices,
  // the enforced wrapper + the validated AuthContext constructor we ship:
  listInvoicesScoped,
  authContext
} from "../../modules/invoice/src/index";

// ───────────────────────────────────────────────────────────────────────────
// PROOF: a cross-tenant data leak is real in naive AI-generated code, and our
// enforced authorization boundary (plans/33) closes it — demonstrated against
// the actual module that ships, not a stand-in.
//
// Setup: ONE deployment, ONE D1 database, shared by two paying orgs (tenant-a,
// tenant-b). This is the multi-tenant SaaS reality — and the exact shape behind
// CVE-2025-48757 (an RLS/scoping miss that exposed data across 170+ Lovable apps).
// ───────────────────────────────────────────────────────────────────────────

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedInvoice(store: ReturnType<typeof createMemoryInvoiceStore>, tenantId: string) {
  const created = await createInvoice(
    {
      tenantId,
      customerId: "cust-1",
      lineItems: [{ description: "Service", quantity: 1, unitAmountCents: 10_000, taxRateBps: 0 }]
    },
    { invoiceStore: store, now: fixedNow(T0) }
  );
  if (!created.ok) throw new Error("seed failed");
  return created.data.id as string;
}

describe("PROOF — a cross-tenant read fails our build", () => {
  it("STEP 1: the leak is real — a route that trusts a request-supplied tenantId reads another org's data", async () => {
    const store = createMemoryInvoiceStore();
    await seedInvoice(store, "tenant-a");
    await seedInvoice(store, "tenant-b");

    // This is what an AI agent writes: the tenant comes from the request. Nothing
    // in the language or the database stops it (D1/SQLite has no row-level security).
    async function naiveRouteHandler(requestSuppliedTenantId: string) {
      return listInvoices({ tenantId: requestSuppliedTenantId }, { invoiceStore: store });
    }

    // tenant-a's user is signed in, but the handler honours an attacker-supplied id:
    const stolen = await naiveRouteHandler("tenant-b");
    expect(stolen.ok).toBe(true);
    if (!stolen.ok) return;

    // The leak, proven: tenant-a's session just read tenant-b's invoices.
    expect(stolen.data.invoices.length).toBeGreaterThan(0);
    expect(stolen.data.invoices.every((i) => i.tenantId === "tenant-b")).toBe(true);
  });

  it("STEP 2: the boundary closes it — the enforced wrapper ignores the forged tenant and returns only the caller's org", async () => {
    const store = createMemoryInvoiceStore();
    await seedInvoice(store, "tenant-a");
    await seedInvoice(store, "tenant-b");

    // The tenant is resolved server-side from the session, never from the request.
    const ctxA = authContext({ orgId: "tenant-a", actorId: "user-a" });

    // Same attack: a forged tenant-b id on the input. The wrapper overrides it
    // with the session's org, so the forged value is inert.
    const result = await listInvoicesScoped(ctxA, { tenantId: "tenant-b" }, { invoiceStore: store });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // No leak: zero tenant-b rows, every row belongs to the caller.
    expect(result.data.invoices.some((i) => i.tenantId === "tenant-b")).toBe(false);
    expect(result.data.invoices.every((i) => i.tenantId === "tenant-a")).toBe(true);
  });

  it("STEP 3: enforcement is structural — a scoped call with no session scope is refused, never run unscoped", async () => {
    const store = createMemoryInvoiceStore();
    await seedInvoice(store, "tenant-a");

    // An empty/partial AuthContext is rejected with 403 rather than falling back
    // to an unscoped query. (A *valid* AuthContext cannot even be constructed
    // without a non-empty org — authContext() throws.)
    const noScope = await listInvoicesScoped(
      { orgId: "", actorId: "x", roles: [] } as never,
      {},
      { invoiceStore: store }
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);

    expect(() => authContext({ orgId: "", actorId: "x" })).toThrow();
  });
});
