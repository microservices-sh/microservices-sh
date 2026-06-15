// Booking lifecycle helpers (revamp P2): cancellation policy + slot holds.
// Cancel/reschedule reuse the booking module's use cases; this layer adds the
// template-owned policy gate and the template-owned `holds` table.
import { and, eq, gt, lte } from "drizzle-orm";
import { getDb } from "./db";
import { holds, type CompanySettings, type Hold } from "./db/schema";

export interface CancelDecision {
  allowed: boolean;
  reason?: string;
}

/** Policy gate. Admins always pass; customers obey allow flag + notice window. */
export function canCancel(
  startsAt: string,
  settings: Pick<CompanySettings, "cancellationAllowed" | "cancellationNoticeHours">,
  isAdmin: boolean,
  now: Date = new Date(),
): CancelDecision {
  if (isAdmin) return { allowed: true };
  if (!settings.cancellationAllowed) return { allowed: false, reason: "Cancellations are not allowed." };
  const hoursUntil = (new Date(startsAt).getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < settings.cancellationNoticeHours) {
    return { allowed: false, reason: `Cancellations require at least ${settings.cancellationNoticeHours}h notice.` };
  }
  return { allowed: true };
}

/** Reserve a slot for holdMinutes; returns the hold id + expiry. */
export async function createHold(
  d1: D1Database,
  opts: { serviceId: string; startsAt: string; endsAt: string; holdMinutes: number; now?: Date },
): Promise<{ id: string; expiresAt: string }> {
  const now = opts.now ?? new Date();
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + opts.holdMinutes * 60_000).toISOString();
  await getDb(d1).insert(holds).values({
    id,
    serviceId: opts.serviceId,
    startsAt: opts.startsAt,
    endsAt: opts.endsAt,
    expiresAt,
    createdAt: now.toISOString(),
  });
  return { id, expiresAt };
}

export async function releaseHold(d1: D1Database, id: string): Promise<void> {
  await getDb(d1).delete(holds).where(eq(holds.id, id));
}

/** Unexpired holds for a service — fed into the availability engine as blocking. */
export async function activeHolds(d1: D1Database, serviceId: string, nowIso: string): Promise<Hold[]> {
  return getDb(d1)
    .select()
    .from(holds)
    .where(and(eq(holds.serviceId, serviceId), gt(holds.expiresAt, nowIso)))
    .all();
}

/** Delete expired holds. Called by the scheduled job / expiry endpoint. */
export async function expireHolds(d1: D1Database, nowIso: string = new Date().toISOString()): Promise<number> {
  const result = await getDb(d1).delete(holds).where(lte(holds.expiresAt, nowIso)).run();
  return result.meta?.changes ?? 0;
}
