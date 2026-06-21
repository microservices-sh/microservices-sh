import { err, enforceScope } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  addTicketCommentInputSchema,
  attachTicketFileInputSchema,
  createTicketShareTokenInputSchema,
  listTicketShareTokensInputSchema,
  listTicketThreadInputSchema,
  revokeTicketShareTokenInputSchema,
  ticketIdSchema
} from "../schemas";
import { supportTicketMeta } from "../meta";
import { addTicketComment } from "./add-ticket-comment";
import { attachTicketFile } from "./attach-ticket-file";
import { createTicket } from "./create-ticket";
import { createTicketShareToken } from "./create-ticket-share-token";
import { getTicket } from "./get-ticket";
import { listTicketShareTokens } from "./list-ticket-share-tokens";
import { listTicketThread } from "./list-ticket-thread";
import { listTickets } from "./list-tickets";
import { revokeTicketShareToken } from "./revoke-ticket-share-token";
import { updateTicket } from "./update-ticket";
import type { TicketStore } from "../ports";

// Enforced-authorization wrappers (plans/33, L1). These are the boundary the app
// should call: the tenant is taken from the server-resolved AuthContext, never
// from caller input, and a ticket reached by id must resolve WITHIN that scope.
// They wrap the existing input-trusting use-cases (kept for back-compat) so the
// migration is additive — see the cross-tenant leak test in support-ticket.test.ts.

type ScopedDeps = {
  store: TicketStore;
  correlationId?: string;
  now?: () => number;
  id?: () => string;
  token?: () => string;
};

// A non-empty org scope must be present. Without one there is no tenant to scope
// to, so the call is refused (403) rather than run against an unknown tenant.
function requireScope(ctx: AuthContext | undefined, deps: ScopedDeps) {
  if (!ctx || typeof ctx.orgId !== "string" || ctx.orgId.length === 0) {
    return err(
      403,
      { code: "support-ticket.SCOPE_REQUIRED", message: "An authenticated org scope is required." },
      supportTicketMeta(deps)
    );
  }
  return null;
}

function inputRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object") return input as Record<string, unknown>;
  return {};
}

function ticketNotFound(deps: ScopedDeps) {
  return err(
    404,
    { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." },
    supportTicketMeta(deps)
  );
}

function shareTokenNotFound(deps: ScopedDeps) {
  return err(
    404,
    { code: "support-ticket.SHARE_TOKEN_NOT_FOUND", message: "Ticket link not found." },
    supportTicketMeta(deps)
  );
}

async function requireTicketInScope(
  ctx: AuthContext,
  ticketId: string,
  deps: ScopedDeps
) {
  const ticket = await deps.store.getTicket(ticketId);
  if (!ticket || !enforceScope(ctx, ticket.tenantId, { assert: false })) {
    return ticketNotFound(deps);
  }
  return null;
}

// Open a ticket in the active org. Any tenantId on `input` is overridden with the
// session's org, so a ticket can never be created under another tenant.
export async function createTicketScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createTicket({ ...inputRecord(input), tenantId: ctx.orgId }, deps);
}

// List the active org's tickets. Any tenantId on `input` is overridden with the
// session's org so a forged value can never widen scope.
export async function listTicketsScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listTickets({ ...inputRecord(input), tenantId: ctx.orgId }, deps);
}

// Fetch one ticket, but only if it belongs to the active org. A foreign id is
// reported as not-found (no existence disclosure across tenants).
export async function getTicketScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const result = await getTicket(input, deps);
  if (!result.ok) return result;
  if (!enforceScope(ctx, result.data.ticket.tenantId, { assert: false })) {
    return ticketNotFound(deps);
  }
  return result;
}

// Patch a ticket only if it belongs to the active org. Ownership is checked
// BEFORE mutating; a foreign or missing id is 404 (same as get), so cross-tenant
// writes are impossible and existence is not disclosed. An unparseable id falls
// through to updateTicket's own 400 validation.
export async function updateTicketScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const idParse = ticketIdSchema.safeParse(input);
  if (idParse.success) {
    const outOfScope = await requireTicketInScope(ctx, idParse.data.id, deps);
    if (outOfScope) return outOfScope;
  }
  return updateTicket(input, deps);
}

export async function addTicketCommentScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = addTicketCommentInputSchema.safeParse(input);
  if (parsed.success) {
    const outOfScope = await requireTicketInScope(ctx, parsed.data.ticketId, deps);
    if (outOfScope) return outOfScope;
  }
  return addTicketComment(input, deps);
}

export async function listTicketThreadScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = listTicketThreadInputSchema.safeParse(input);
  if (parsed.success) {
    const outOfScope = await requireTicketInScope(ctx, parsed.data.ticketId, deps);
    if (outOfScope) return outOfScope;
  }
  return listTicketThread(input, deps);
}

export async function attachTicketFileScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = attachTicketFileInputSchema.safeParse(input);
  if (parsed.success) {
    const outOfScope = await requireTicketInScope(ctx, parsed.data.ticketId, deps);
    if (outOfScope) return outOfScope;
  }
  return attachTicketFile(input, deps);
}

export async function createTicketShareTokenScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = createTicketShareTokenInputSchema.safeParse(input);
  if (parsed.success) {
    const outOfScope = await requireTicketInScope(ctx, parsed.data.ticketId, deps);
    if (outOfScope) return outOfScope;
  }
  return createTicketShareToken(input, deps);
}

export async function listTicketShareTokensScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = listTicketShareTokensInputSchema.safeParse(input);
  if (parsed.success) {
    const outOfScope = await requireTicketInScope(ctx, parsed.data.ticketId, deps);
    if (outOfScope) return outOfScope;
  }
  return listTicketShareTokens(input, deps);
}

export async function revokeTicketShareTokenScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = revokeTicketShareTokenInputSchema.safeParse(input);
  if (parsed.success) {
    const shareToken = await deps.store.getTicketShareToken(parsed.data.id);
    if (!shareToken || !enforceScope(ctx, shareToken.tenantId, { assert: false })) {
      return shareTokenNotFound(deps);
    }
  }
  return revokeTicketShareToken(input, deps);
}
