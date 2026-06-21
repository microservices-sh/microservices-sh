import { ok, err } from "@microservices-sh/connection-contract";
import { revokeTicketShareTokenInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent } from "../types";

export async function revokeTicketShareToken(
  input: unknown,
  deps: { store: TicketStore; correlationId?: string; now?: () => number }
) {
  const meta = supportTicketMeta(deps);
  const parsed = revokeTicketShareTokenInputSchema.safeParse(input);
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

  const shareToken = await deps.store.revokeTicketShareToken(parsed.data.id);
  if (!shareToken) {
    return err(404, { code: "support-ticket.SHARE_TOKEN_NOT_FOUND", message: "Ticket link not found." }, meta);
  }

  const event: DomainEvent = {
    name: "support-ticket.share-token.revoked",
    correlationId: meta.correlationId,
    payload: {
      id: shareToken.id,
      tenantId: shareToken.tenantId,
      ticketId: shareToken.ticketId
    }
  };

  return ok(200, { shareToken, event }, meta);
}
