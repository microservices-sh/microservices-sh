import { ok, err } from "@microservices-sh/connection-contract";
import { resolveTicketShareTokenInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { TicketPublicSnapshot } from "../types";

export async function resolveTicketShareToken(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);
  const parsed = resolveTicketShareTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "support-ticket.INVALID_SHARE_TOKEN_INPUT",
        message: "Ticket share-token input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const shareToken = await deps.store.getTicketShareTokenByToken(parsed.data.token);
  if (!shareToken || !shareToken.isActive) {
    return err(404, { code: "support-ticket.SHARE_TOKEN_NOT_FOUND", message: "Ticket link not found." }, meta);
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  if (shareToken.expiresAt && Date.parse(shareToken.expiresAt) < Date.parse(nowIso)) {
    return err(410, { code: "support-ticket.SHARE_TOKEN_EXPIRED", message: "Ticket link has expired." }, meta);
  }

  const ticket = await deps.store.getTicket(shareToken.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  await deps.store.touchTicketShareToken(shareToken.token, nowIso);
  const snapshot: TicketPublicSnapshot = {
    ticket,
    shareToken: { ...shareToken, lastAccessedAt: nowIso },
    comments: await deps.store.listTicketComments(ticket.id, false),
    attachments: await deps.store.listTicketAttachments(ticket.id)
  };

  return ok(200, { snapshot }, meta);
}
