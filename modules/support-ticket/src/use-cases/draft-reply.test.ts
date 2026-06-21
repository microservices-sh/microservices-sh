import { describe, expect, it } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import { createMemoryTicketStore } from "../adapters/memory-ticket-store";
import { createTicket } from "./create-ticket";
import { createTicketScoped } from "./scoped";
import { draftTicketReply, draftTicketReplyScoped } from "./draft-reply";

const now = () => Date.parse("2026-06-21T00:00:00.000Z");

// A GroundedAnswerer that returns a fixed cited answer (or a refusal when empty).
function answerer(answer: string, citedSourceFiles: string[]) {
  const calls: string[] = [];
  return { calls, async answer(q: string) { calls.push(q); return { answer, citedSourceFiles }; } };
}

const baseTicket = { subject: "Refund question", description: "How long do I have to request a refund?", requesterEmail: "a@example.com" };

describe("support-ticket: draft grounded reply", () => {
  it("drafts a cited reply when the KB grounds the ticket (and never auto-sends)", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket({ tenantId: "acme", ...baseTicket }, { store, now });
    if (!created.ok) throw new Error("setup");
    const a = answerer("Customers may request a refund within 7 days of purchase.", ["refund-policy.md"]);

    const r = await draftTicketReply({ id: created.data.ticket.id }, { store, answerer: a, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.draft).toContain("7 days");
    expect(r.data.citations).toEqual(["refund-policy.md"]);
    expect(r.data.status).toBe("draft"); // a human reviews before sending
    // the ticket's own subject+description drove the query
    expect(a.calls[0]).toContain("How long do I have to request a refund?");
  });

  it("refuses to draft an ungrounded reply (cite-or-refuse — no hallucinated promises)", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket({ tenantId: "acme", ...baseTicket }, { store, now });
    if (!created.ok) throw new Error("setup");

    const empty = await draftTicketReply({ id: created.data.ticket.id }, { store, answerer: answerer("", []), now });
    expect(empty.ok).toBe(false);
    if (empty.ok) throw new Error("expected refuse");
    expect(empty.error.code).toBe("support-ticket.REPLY_NOT_GROUNDED");

    // an answer without citations is also refused (it isn't grounded)
    const uncited = await draftTicketReply({ id: created.data.ticket.id }, { store, answerer: answerer("Sure, full refund any time!", []), now });
    expect(uncited.ok).toBe(false);
  });

  it("404s for an unknown ticket", async () => {
    const store = createMemoryTicketStore();
    const r = await draftTicketReply({ id: "tk_missing" }, { store, answerer: answerer("x", ["a"]), now });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected error");
    expect(r.error.code).toBe("support-ticket.TICKET_NOT_FOUND");
  });

  it("scoped: cannot draft a reply for another tenant's ticket", async () => {
    const store = createMemoryTicketStore();
    const acme = authContext({ orgId: "acme", actorId: "agent-a" });
    const other = authContext({ orgId: "other", actorId: "agent-b" });
    const created = await createTicketScoped(acme, baseTicket, { store, now });
    if (!created.ok) throw new Error("setup");

    const leak = await draftTicketReplyScoped(other, { id: created.data.ticket.id }, { store, answerer: answerer("x", ["a"]), now });
    expect(leak.ok).toBe(false);
    if (leak.ok) throw new Error("expected isolation");
    expect(leak.error.code).toBe("support-ticket.TICKET_NOT_FOUND"); // cross-tenant → not found
  });

  it("scoped: requires an org scope", async () => {
    const store = createMemoryTicketStore();
    // A raw context with no org (authContext() itself rejects empty orgId).
    const r = await draftTicketReplyScoped({ orgId: "" } as any, { id: "tk_1" }, { store, answerer: answerer("x", ["a"]), now });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected denied");
    expect(r.error.code).toBe("support-ticket.SCOPE_REQUIRED");
  });
});
