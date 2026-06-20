import { describe, expect, it } from "vitest";
import { handleOpsRequest, type OpsTokenVerifier } from "./ops-server";
import {
  OPS_TOOL_SCOPES,
  createOpsRegistry,
  toBookingRecord,
  toCustomerRecord,
  toInvoiceRecord,
  toTicketRecord
} from "./ops-registry";

const NOW = 1_750_000_000_000;

describe("ops record mappers (operational record → cited evidence)", () => {
  it("maps a customer to a cited OpsRecord", () => {
    const r = toCustomerRecord({ id: "cus_1", name: "ACME Corp", phone: "555-0100", notes: "VIP" }, NOW);
    expect(r).toMatchObject({ module: "customer", entityId: "cus_1", asOf: NOW });
    expect(r.label).toContain("ACME Corp");
    expect(r.text).toContain("ACME Corp");
    expect(r.text).toContain("555-0100");
  });

  it("maps an invoice, surfacing status + amount", () => {
    const r = toInvoiceRecord({ invoiceId: "inv_9", customerId: "cus_1", currency: "USD", status: "overdue", totalCents: 120000 }, NOW);
    expect(r).toMatchObject({ module: "invoice", entityId: "inv_9" });
    expect(r.text.toLowerCase()).toContain("overdue");
  });

  it("maps a booking and a ticket", () => {
    const b = toBookingRecord({ id: "bk_1", serviceId: "svc_1", date: "2026-07-01", customerName: "ACME" }, NOW);
    expect(b).toMatchObject({ module: "booking", entityId: "bk_1" });
    expect(b.text).toContain("2026-07-01");

    const t = toTicketRecord({ id: "tk_1", subject: "Login broken", status: "open" }, NOW);
    expect(t).toMatchObject({ module: "support-ticket", entityId: "tk_1" });
    expect(t.label).toContain("Login broken");
  });
});

describe("createOpsRegistry", () => {
  it("attaches the canonical scope per tool (ticket → ops.support_ticket.read)", () => {
    const reg = createOpsRegistry({
      "ops.customer.read": async () => [],
      "ops.ticket.read": async () => []
    });
    expect(reg["ops.customer.read"].scope).toBe("ops.customer.read");
    expect(reg["ops.ticket.read"].scope).toBe(OPS_TOOL_SCOPES["ops.ticket.read"]);
    expect(reg["ops.ticket.read"].scope).toBe("ops.support_ticket.read");
  });

  it("throws on an unknown tool name (typo protection)", () => {
    expect(() => createOpsRegistry({ "ops.payroll.read": async () => [] } as any)).toThrow(/payroll/);
  });

  it("dispatches a real module read end-to-end through handleOpsRequest", async () => {
    // Faithful customer read use-case shape: (input, deps) -> { ok, data: { customer } }.
    const repo = { cus_1: { id: "cus_1", name: "ACME Corp", phone: "555-0100" } };
    const getCustomer = async (input: { id: string }) =>
      repo[input.id] ? { ok: true as const, data: { customer: repo[input.id] } } : { ok: false as const };

    const registry = createOpsRegistry({
      "ops.customer.read": async (args, { ownerId }) => {
        const res = await getCustomer({ id: String(args.id) });
        return res.ok ? [toCustomerRecord(res.data.customer, NOW)] : [];
      }
    });
    const verifier: OpsTokenVerifier = { async verify() { return { ok: true, ownerId: "owner_1", scopes: ["ops.customer.read"] }; } };

    const res = await handleOpsRequest({ tool: "ops.customer.read", token: "t", ownerHeader: "owner_1", args: { id: "cus_1" } }, { registry, verifier });
    expect(res.status).toBe(200);
    const records = (res.body as any).records;
    expect(records[0]).toMatchObject({ module: "customer", entityId: "cus_1" });
    expect(records[0].text).toContain("ACME Corp");
  });
});
