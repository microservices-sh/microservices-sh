import { ok } from "@microservices-sh/connection-contract";
import { fileMediaMeta } from "../meta";
import type { MediaStore, ObjectStorage } from "../ports";

// Orphan cleanup: for every pending ticket past its expiry, delete any object
// that was uploaded but never completed, then mark the ticket expired. Run this
// on a jobs-workflows schedule. This is the cleanup agents forget, which is how
// R2 silently accumulates abandoned upload bytes.
export async function expireStaleTickets(deps: {
  mediaStore: MediaStore;
  storage: ObjectStorage;
  now?: () => number;
  limit?: number;
  correlationId?: string;
}) {
  const meta = fileMediaMeta(deps);
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const stale = await deps.mediaStore.listExpiredTickets(nowIso, deps.limit ?? 100);

  const events: Array<{ name: string; correlationId: string; payload: Record<string, unknown> }> = [];
  let cleaned = 0;
  for (const ticket of stale) {
    try {
      await deps.storage.delete(ticket.key);
    } catch {
      /* object may never have been uploaded; expiring the ticket is still correct */
    }
    ticket.status = "expired";
    await deps.mediaStore.updateTicket(ticket);
    events.push({
      name: "media.ticket_expired",
      correlationId: meta.correlationId,
      payload: { ticketId: ticket.id, tenantId: ticket.tenantId, key: ticket.key }
    });
    cleaned += 1;
  }

  return ok(200, { cleaned, events }, meta);
}
