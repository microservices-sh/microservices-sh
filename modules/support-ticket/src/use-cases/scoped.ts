import { err, enforceScope } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { ticketIdSchema } from "../schemas";
import { supportTicketMeta } from "../meta";
import { getTicket } from "./get-ticket";
import { listTickets } from "./list-tickets";
import { updateTicket } from "./update-ticket";
import type { TicketStore } from "../ports";

// Enforced-authorization wrappers (plans/33, L1). These are the boundary the app
// should call: the tenant is taken from the server-resolved AuthContext, never
// from caller input, and a ticket reached by id must resolve WITHIN that scope.
// They wrap the existing input-trusting use-cases (kept for back-compat) so the
// migration is additive — see the cross-tenant leak test in support-ticket.test.ts.

type ScopedDeps = { store: TicketStore; correlationId?: string; now?: () => number };

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

// List the active org's tickets. Any tenantId on `input` is overridden with the
// session's org so a forged value can never widen scope.
export async function listTicketsScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return listTickets({ ...base, tenantId: ctx.orgId }, deps);
}

// Fetch one ticket, but only if it belongs to the active org. A foreign id is
// reported as not-found (no existence disclosure across tenants).
export async function getTicketScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const result = await getTicket(input, deps);
  if (!result.ok) return result;
  if (!enforceScope(ctx, result.data.ticket.tenantId, { assert: false })) {
    return err(
      404,
      { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." },
      supportTicketMeta(deps)
    );
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
    const existing = await deps.store.getTicket(idParse.data.id);
    if (!existing || !enforceScope(ctx, existing.tenantId, { assert: false })) {
      return err(
        404,
        { code: "support-ticket.TICKET_NOT_FOUND", message: "Ticket not found." },
        supportTicketMeta(deps)
      );
    }
  }
  return updateTicket(input, deps);
}
