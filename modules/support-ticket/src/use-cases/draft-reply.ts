import { ok, err } from "@microservices-sh/connection-contract";
import type { AuthContext, Meta } from "@microservices-sh/connection-contract";
import { supportTicketMeta } from "../meta";
import { getTicket } from "./get-ticket";
import { getTicketScoped } from "./scoped";
import type { GroundedAnswerer, TicketStore } from "../ports";
import type { Ticket } from "../types";

// Draft a support reply GROUNDED in the knowledge base — the first reuse of the
// research stack (retriever + synthesizer + cite-or-refuse) in another module.
// The agent drafts; a human reviews and sends (status "draft", never auto-sent).
// If the KB doesn't ground the ticket, we REFUSE rather than fabricate a reply —
// a hallucinated "we'll refund you" to a customer is real liability.

type DraftDeps = { store: TicketStore; answerer: GroundedAnswerer; correlationId?: string; now?: () => number };

async function replyFromTicket(ticket: Ticket, deps: DraftDeps, meta: Meta) {
  const question = `${ticket.subject}\n\n${ticket.description}`.trim();
  const { answer, citedSourceFiles } = await deps.answerer.answer(question);

  // Cite-or-refuse: a reply with no grounded citation must not reach a customer.
  if (!answer.trim() || citedSourceFiles.length === 0) {
    return err(
      422,
      {
        code: "support-ticket.REPLY_NOT_GROUNDED",
        message: "No grounded knowledge answers this ticket; escalate to a human."
      },
      meta
    );
  }

  return ok(200, { ticketId: ticket.id, draft: answer, citations: citedSourceFiles, status: "draft" as const }, meta);
}

// Input-trusting core (composes getTicket). Prefer the scoped variant at the boundary.
export async function draftTicketReply(input: unknown, deps: DraftDeps) {
  const got = await getTicket(input, deps);
  if (!got.ok) return got;
  return replyFromTicket(got.data.ticket, deps, supportTicketMeta(deps));
}

// Tenant-safe boundary: the ticket must resolve within the session's org.
export async function draftTicketReplyScoped(ctx: AuthContext, input: unknown, deps: DraftDeps) {
  const got = await getTicketScoped(ctx, input, deps);
  if (!got.ok) return got;
  return replyFromTicket(got.data.ticket, deps, supportTicketMeta(deps));
}
