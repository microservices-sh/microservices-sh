import { ok, err } from "@microservices-sh/connection-contract";
import { createTicketShareTokenInputSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import type { TicketStore } from "../ports";
import type { DomainEvent, TicketShareToken } from "../types";

function createDefaultShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createTicketShareToken(
  input: unknown,
  deps: {
    store: TicketStore;
    now?: () => number;
    id?: () => string;
    token?: () => string;
    correlationId?: string;
  }
) {
  const meta = supportTicketMeta(deps);
  const parsed = createTicketShareTokenInputSchema.safeParse(input);
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

  if (parsed.data.expiresAt && Number.isNaN(Date.parse(parsed.data.expiresAt))) {
    return err(
      400,
      { code: "support-ticket.INVALID_SHARE_TOKEN_INPUT", message: "Share-token expiry must be a valid date string." },
      meta
    );
  }

  const ticket = await deps.store.getTicket(parsed.data.ticketId);
  if (!ticket) {
    return err(404, { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." }, meta);
  }

  const shareToken: TicketShareToken = {
    id: deps.id?.() ?? "tshr_" + crypto.randomUUID().slice(0, 16),
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    token: deps.token?.() ?? createDefaultShareToken(),
    isActive: true,
    expiresAt: parsed.data.expiresAt ?? null,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
    lastAccessedAt: null
  };

  await deps.store.insertTicketShareToken(shareToken);

  const event: DomainEvent = {
    name: "support-ticket.share-token.created",
    correlationId: meta.correlationId,
    payload: {
      id: shareToken.id,
      tenantId: shareToken.tenantId,
      ticketId: shareToken.ticketId,
      expiresAt: shareToken.expiresAt
    }
  };

  return ok(201, { shareToken, event }, meta);
}
