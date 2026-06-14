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
}) {
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const stale = await deps.mediaStore.listExpiredTickets(nowIso, deps.limit ?? 100);

  let cleaned = 0;
  for (const ticket of stale) {
    try {
      await deps.storage.delete(ticket.key);
    } catch {
      /* object may never have been uploaded; expiring the ticket is still correct */
    }
    ticket.status = "expired";
    await deps.mediaStore.updateTicket(ticket);
    cleaned += 1;
  }

  return { ok: true as const, status: 200 as const, data: { cleaned } };
}
