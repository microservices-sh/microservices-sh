import { describe, expect, it } from "vitest";
// Relative source imports (modules aren't root-hoisted).
import { customerSummary } from "../../modules/research/src/customer-summary";
import { createOperateHttpClient } from "../../modules/research/src/adapters/operate-http-client";
import { handleOpsRequest } from "../../modules/research/src/ops-server";
import { createOpsRegistry, toBookingRecord, toCustomerRecord, toInvoiceRecord, toTicketRecord } from "../../modules/research/src/ops-registry";
import { createGatewaySynthesizer } from "../../modules/research/src/adapters/gateway-synthesizer";
import { mintOpsToken, createOpsTokenVerifier } from "../../modules/research/src/ops-token";

// True e2e: Customer 360 over the REAL ops read-back stack — opsRead (govern) →
// operate-http-client → handleOpsRequest (verify token→owner, server-side scope) →
// per-module handlers → cited summary. The fetch is wired to the operate server;
// only the LLM is stubbed (and cites only retrieved records).

const NOW = 1_750_000_000_000;
const now = () => NOW;
const ownerId = "acme";
const SECRET = "tenant-shared-secret-acme";

// Operate-side: bind the customer/invoice/booking/ticket tools to handlers.
const registry = createOpsRegistry({
  "ops.customer.read": async (args) => [toCustomerRecord({ id: String(args.id ?? args.customerId), name: "ACME Corp", phone: "555-0100" }, NOW)],
  "ops.invoice.read": async (args) => [toInvoiceRecord({ invoiceId: "inv_9", customerId: String(args.customerId), currency: "USD", status: "overdue", totalCents: 120000 }, NOW)],
  "ops.booking.read": async () => [toBookingRecord({ id: "bk_2", serviceId: "svc_1", date: "2026-07-01", customerName: "ACME Corp" }, NOW)],
  "ops.ticket.read": async () => [toTicketRecord({ id: "tk_3", subject: "Login issue", status: "open" }, NOW)]
});
const verifier = createOpsTokenVerifier({ secret: SECRET, now });

// fetch that routes the client's HTTP request into the operate server.
function fetchImpl(url: string, init: any) {
  const tool = url.split("/ops/")[1];
  const token = (init.headers.authorization ?? "").replace(/^Bearer\s+/, "") || null;
  const ownerHeader = init.headers["x-owner-id"] ?? null;
  const { args } = JSON.parse(init.body);
  return handleOpsRequest({ tool, token, ownerHeader, args }, { registry, verifier }).then((res) => ({
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    async json() { return res.body; }
  })) as any;
}

// Stub LLM: cite only the records the prompt actually carried.
const complete = async (messages: { role: string; content: string }[]) => {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const refs = [...user.matchAll(/source_file=(\S+)/g)].map((m) => m[1]);
  return { ok: true as const, data: { text: JSON.stringify({ answer: "ACME Corp (VIP): one overdue invoice of $1,200, an upcoming booking, and one open support ticket.", citations: refs }) } };
};

describe("e2e: Customer 360 over the real ops read-back stack", () => {
  it("assembles a cited summary from the customer's live records across modules", async () => {
    const scopes = ["ops.customer.read", "ops.invoice.read", "ops.booking.read", "ops.support_ticket.read"];
    const token = await mintOpsToken({ ownerId, scopes, exp: NOW + 60_000 }, { secret: SECRET });
    const client = createOperateHttpClient({ baseUrl: "https://acme-operate.example", serviceToken: token, fetch: fetchImpl });
    const synthesizer = createGatewaySynthesizer(complete);
    const actor = { id: ownerId, scopes };

    const r = await customerSummary({ customerId: "cus_1" }, { client, synthesizer, actor, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.summary).toContain("overdue");
    // grounded in real records pulled through the full stack
    expect(r.data.citations).toEqual(expect.arrayContaining(["customer:cus_1", "invoice:inv_9", "booking:bk_2", "support-ticket:tk_3"]));
  });

  it("a token without the ticket scope yields a summary that excludes tickets (server-side gate)", async () => {
    const scopes = ["ops.customer.read", "ops.invoice.read"]; // no booking, no ticket
    const token = await mintOpsToken({ ownerId, scopes, exp: NOW + 60_000 }, { secret: SECRET });
    const client = createOperateHttpClient({ baseUrl: "https://acme-operate.example", serviceToken: token, fetch: fetchImpl });
    const synthesizer = createGatewaySynthesizer(complete);
    const actor = { id: ownerId, scopes };

    const r = await customerSummary({ customerId: "cus_1" }, { client, synthesizer, actor, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.citations).toContain("invoice:inv_9");
    expect(r.data.citations).not.toContain("support-ticket:tk_3");
  });
});
