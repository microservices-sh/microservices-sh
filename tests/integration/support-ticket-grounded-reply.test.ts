import { describe, expect, it } from "vitest";
// Relative source imports — neither module is root-hoisted (no lockfile change),
// exercising the REAL module source across the boundary.
import {
  createGraphRetriever,
  createGroundedAnswerer,
  createMemoryGraphStore,
  loadGraphifyOutput
} from "../../modules/research/src/index";
import { createGatewaySynthesizer } from "../../modules/research/src/adapters/gateway-synthesizer";
import { createMemoryTicketStore, createTicket, draftTicketReply } from "../../modules/support-ticket/src/index";

// True cross-module e2e: REAL research retrieval (memory graph store loaded from a
// corpus) → REAL grounded-answerer → REAL support-ticket draft use-case. Only the
// LLM is stubbed, and the stub cites ONLY what was actually retrieved, so a draft
// can only exist if real retrieval grounded it.

const ownerId = "acme";

const corpus = {
  semantic: {
    nodes: [
      { id: "refund_policy", label: "Refund Policy", file_type: "document", source_file: "refund-policy.md", source_location: null },
      { id: "refund_seven_days", label: "7 Day Refund Window", file_type: "concept", source_file: "refund-policy.md", source_location: null },
      { id: "auth_doc", label: "Authentication", file_type: "document", source_file: "auth.md", source_location: null }
    ],
    edges: [{ source: "refund_policy", target: "refund_seven_days", relation: "references", weight: 1 }]
  },
  analysis: { communities: { "0": ["refund_policy", "refund_seven_days"], "1": ["auth_doc"] } },
  labels: { "0": "Billing", "1": "Auth" }
};

// Stub LLM: cite only the source_files the prompt actually carried (i.e. what was
// retrieved), so the draft is genuinely grounded in real retrieval.
const complete = async (messages: { role: string; content: string }[]) => {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const refs = [...user.matchAll(/source_file=(\S+)/g)].map((m) => m[1]);
  return { ok: true as const, data: { text: JSON.stringify({ answer: "Customers may request a refund within 7 days of purchase.", citations: refs.slice(0, 1) }) } };
};

async function wire() {
  const graph = createMemoryGraphStore();
  await loadGraphifyOutput(corpus, { store: graph, ownerId });
  const retriever = createGraphRetriever(graph, { readContent: ({ sourceFile }) => `Excerpt of ${sourceFile}: refunds within 7 days.` });
  const synthesizer = createGatewaySynthesizer(complete);
  const answerer = createGroundedAnswerer(retriever, synthesizer, { ownerId });
  const tickets = createMemoryTicketStore();
  const now = () => Date.parse("2026-06-21T00:00:00.000Z");
  return { answerer, tickets, now };
}

describe("e2e: support-ticket grounded reply over real research retrieval", () => {
  it("drafts a cited reply for a ticket the KB grounds", async () => {
    const { answerer, tickets, now } = await wire();
    const created = await createTicket(
      { tenantId: ownerId, subject: "Refund question", description: "How long do I have to request a refund?", requesterEmail: "a@example.com" },
      { store: tickets, now }
    );
    if (!created.ok) throw new Error("setup");

    const r = await draftTicketReply({ id: created.data.ticket.id }, { store: tickets, answerer, now });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.draft).toContain("7 days");
    expect(r.data.citations).toEqual(["refund-policy.md"]); // grounded in the real retrieved node
    expect(r.data.status).toBe("draft");
  });

  it("refuses when the KB does not ground the ticket (real empty retrieval)", async () => {
    const { answerer, tickets, now } = await wire();
    const created = await createTicket(
      { tenantId: ownerId, subject: "Spaceship warranty", description: "Does my hovercraft qualify for warp-drive servicing?", requesterEmail: "a@example.com" },
      { store: tickets, now }
    );
    if (!created.ok) throw new Error("setup");

    const r = await draftTicketReply({ id: created.data.ticket.id }, { store: tickets, answerer, now });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected refusal");
    expect(r.error.code).toBe("support-ticket.REPLY_NOT_GROUNDED");
  });
});
