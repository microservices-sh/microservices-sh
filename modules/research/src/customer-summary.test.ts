import { describe, expect, it } from "vitest";
import type { OpsClient, OpsRecord } from "./ops";
import { customerSummary } from "./customer-summary";

const NOW = 1_750_000_000_000;
const now = () => NOW;

const RECORDS: Record<string, OpsRecord[]> = {
  "ops.customer.read": [{ module: "customer", entityId: "cus_1", asOf: NOW, label: "ACME Corp", text: "ACME Corp — VIP account" }],
  "ops.invoice.read": [{ module: "invoice", entityId: "inv_9", asOf: NOW, label: "Invoice inv_9", text: "ACME overdue $1,200" }],
  "ops.ticket.read": [{ module: "support-ticket", entityId: "tk_3", asOf: NOW, label: "Ticket: login issue", text: "open support ticket" }]
};

function client(records = RECORDS): OpsClient {
  return { async read(call) { return records[call.tool] ?? []; } };
}

// Synthesizer that cites exactly the records it was given.
const synth = {
  async synthesize({ passages }: any) {
    return { answer: "ACME Corp (VIP): one overdue invoice of $1,200 and one open support ticket.", citedSourceFiles: passages.map((p: any) => p.sourceFile) };
  }
};

const actor = { id: "owner_1", scopes: ["ops.customer.read", "ops.invoice.read", "ops.support_ticket.read", "ops.booking.read"] };

describe("customerSummary (Customer 360)", () => {
  it("summarizes a customer from their live ops records, with citations to each record", async () => {
    const r = await customerSummary({ customerId: "cus_1" }, { client: client(), synthesizer: synth, actor, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.summary).toContain("overdue");
    expect(r.data.citations).toContain("customer:cus_1");
    expect(r.data.citations).toContain("invoice:inv_9");
    expect(r.data.citations).toContain("support-ticket:tk_3");
    expect(r.data.customerId).toBe("cus_1");
  });

  it("refuses when the customer has no live records (cite-or-refuse)", async () => {
    const r = await customerSummary({ customerId: "ghost" }, { client: client({}), synthesizer: synth, actor, now });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected refusal");
    expect(r.error.code).toBe("CUSTOMER_NO_RECORDS");
  });

  it("skips tools the actor is not scoped for, summarizing from the rest", async () => {
    const limited = { id: "owner_1", scopes: ["ops.customer.read", "ops.invoice.read"] }; // no ticket scope
    const r = await customerSummary({ customerId: "cus_1" }, { client: client(), synthesizer: synth, actor: limited, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.citations).toContain("invoice:inv_9");
    expect(r.data.citations).not.toContain("support-ticket:tk_3"); // unscoped → skipped
  });
});
