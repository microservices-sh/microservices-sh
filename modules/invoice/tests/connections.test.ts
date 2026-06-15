import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createInvoice, issueInvoice } from "../src/index";
import { createMemoryInvoiceStore } from "../src/adapters/memory-invoice-store";
import { createMemoryNumberAllocator } from "../src/adapters/memory-number-allocator";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

// invoice declares `requires: ["customer"]` but makes no rpc.calls into it today
// (customerId is a stored reference, not a cross-module fetch). Synthesize the
// minimal customer slice so the requires edge resolves at compose time.
const customerConnections = {
  rpc: { exposes: [{ method: "getCustomer", scope: "customer.read", public: false }] },
};

const validInvoice = {
  tenantId: "tenant-1",
  customerId: "cust-1",
  lineItems: [{ description: "Service", quantity: 1, unitAmountCents: 10_000, taxRateBps: 0 }],
};

const deps = () => ({ invoiceStore: createMemoryInvoiceStore(), allocator: createMemoryNumberAllocator() });

describe("invoice connections manifest", () => {
  it("composes with its required customer dependency", () => {
    const r = compose([
      { id: "customer", grantedScopes: [], connections: customerConnections },
      { id: "invoice", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("invoice");
  });

  it("fails to compose when the required customer module is absent (MISSING_MODULE)", () => {
    const r = compose([
      { id: "invoice", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === "MISSING_MODULE")).toBe(true);
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeInvoiceIssue.kind).toBe("filter");
    expect(manifest.connections.hookPoints.onInvoiceIssued.kind).toBe("observer");
    expect(manifest.connections.hookPoints.onInvoicePaid.kind).toBe("observer");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("invoice.issued");
    expect(manifest.connections.events.emits).toContain("invoice.paid");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("invoice use-cases: meta + namespaced errors + correlationId", () => {
  it("threads correlationId through meta and the emitted event", async () => {
    const r = await createInvoice(validInvoice, { ...deps(), correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await createInvoice({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invoice.INVALID_INVOICE_INPUT");
    expect(r.meta.source).toBe("invoice");
  });

  it("a cross-module beforeInvoiceIssue guard hook can veto the issue", async () => {
    const d = deps();
    const created = await createInvoice(validInvoice, d);
    if (!created.ok) throw new Error("setup failed");

    const guard = {
      kind: "guard" as const,
      order: 10,
      fn: async () => ({ ok: false as const, status: 409, error: { code: "invoice.BLOCKED", message: "blocked" } }),
    };
    const r = await issueInvoice(
      { invoiceId: created.data.id },
      { ...d, correlationId: "corr-y", beforeIssueHooks: [guard] }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("invoice.BLOCKED");
      expect(r.status).toBe(409);
    }
    expect(r.meta.correlationId).toBe("corr-y");
  });
});
