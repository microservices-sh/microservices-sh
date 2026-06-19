import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import type { AvailabilitySlot, Booking, DomainEvent, Service } from "../types";
import type { BookingRepository } from "../ports";
import { services, bookings, customers, domainEvents, auditEvents } from "../db/schema";

function toService(row: {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  status: string;
}): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    currency: row.currency,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

// Joined booking row (booking columns + service/customer display fields).
function toBooking(row: {
  id: string;
  customerId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  accessToken: string | null;
  createdAt: string;
  updatedAt: string;
  serviceName: string | null;
  customerName: string | null;
  customerEmail: string | null;
}): Booking {
  return {
    id: row.id,
    customerId: row.customerId,
    serviceId: row.serviceId,
    serviceName: row.serviceName ?? row.serviceId,
    customerName: row.customerName ?? "",
    customerEmail: row.customerEmail ?? "",
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status === "cancelled" ? "cancelled" : "confirmed",
    notes: row.notes ? String(row.notes) : null,
    // Legacy rows have NULL access_token → "" (never satisfies verification).
    accessToken: row.accessToken ? String(row.accessToken) : "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createD1BookingRepository(d1: D1Database): BookingRepository {
  const db = drizzle(d1);

  const serviceColumns = {
    id: services.id,
    name: services.name,
    description: services.description,
    durationMinutes: services.durationMinutes,
    priceCents: services.priceCents,
    currency: services.currency,
    status: services.status,
  };

  // The service/customer columns joined onto every booking read.
  const bookingSelection = {
    id: bookings.id,
    customerId: bookings.customerId,
    serviceId: bookings.serviceId,
    startsAt: bookings.startsAt,
    endsAt: bookings.endsAt,
    status: bookings.status,
    notes: bookings.notes,
    accessToken: bookings.accessToken,
    createdAt: bookings.createdAt,
    updatedAt: bookings.updatedAt,
    serviceName: services.name,
    customerName: customers.name,
    customerEmail: customers.email,
  };

  return {
    async listServices() {
      const rows = await db
        .select(serviceColumns)
        .from(services)
        .where(eq(services.status, "active"))
        .orderBy(services.name);
      return rows.map(toService);
    },

    async getService(serviceId) {
      const row = await db.select(serviceColumns).from(services).where(eq(services.id, serviceId)).get();
      return row ? toService(row) : null;
    },

    async findAvailability(input) {
      const service = await this.getService(input.serviceId);
      if (!service) return [];
      const base = new Date(`${input.date}T09:00:00.000Z`);
      const slots: AvailabilitySlot[] = [];

      for (let index = 0; index < 8; index += 1) {
        const starts = new Date(base.getTime() + index * 60 * 60_000);
        const ends = new Date(starts.getTime() + service.durationMinutes * 60_000);
        const available = await this.isSlotAvailable({
          serviceId: input.serviceId,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
        });
        slots.push({
          serviceId: input.serviceId,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          available,
        });
      }

      return slots;
    },

    async isSlotAvailable(input) {
      // Overlap: an existing confirmed booking that starts before this ends and
      // ends after this starts. Touching boundaries (>=/<=) do NOT overlap.
      const row = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.serviceId, input.serviceId),
            eq(bookings.status, "confirmed"),
            lt(bookings.startsAt, input.endsAt),
            gt(bookings.endsAt, input.startsAt)
          )
        )
        .limit(1)
        .get();
      return !row;
    },

    async createBooking(input) {
      const timestamp = new Date().toISOString();
      const booking: Booking = {
        id: `bk_${crypto.randomUUID().slice(0, 12)}`,
        customerId: input.customerId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        serviceId: input.serviceId,
        serviceName: input.serviceName,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "confirmed",
        notes: input.notes ?? null,
        accessToken: input.accessToken,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(bookings).values({
        id: booking.id,
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
        notes: booking.notes,
        accessToken: booking.accessToken,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      });
      return booking;
    },

    async listBookings() {
      const rows = await db
        .select(bookingSelection)
        .from(bookings)
        .innerJoin(services, eq(services.id, bookings.serviceId))
        .innerJoin(customers, eq(customers.id, bookings.customerId))
        .orderBy(desc(bookings.startsAt))
        .limit(100);
      return rows.map(toBooking);
    },

    async getBooking(id) {
      const row = await db
        .select(bookingSelection)
        .from(bookings)
        .innerJoin(services, eq(services.id, bookings.serviceId))
        .innerJoin(customers, eq(customers.id, bookings.customerId))
        .where(eq(bookings.id, id))
        .get();
      return row ? toBooking(row) : null;
    },

    async cancelBooking(id) {
      const timestamp = new Date().toISOString();
      await db.update(bookings).set({ status: "cancelled", updatedAt: timestamp }).where(eq(bookings.id, id));
      return this.getBooking(id);
    },

    async writeEvent(event: DomainEvent) {
      const timestamp = new Date().toISOString();
      await db.insert(domainEvents).values({
        id: `evt_${crypto.randomUUID().slice(0, 12)}`,
        eventName: event.eventName,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: JSON.stringify(event.payload),
        createdAt: timestamp,
      });
      await db.insert(auditEvents).values({
        id: `aud_${crypto.randomUUID().slice(0, 12)}`,
        eventName: event.eventName,
        actorId: String(event.payload.actorId ?? ""),
        entityType: event.entityType,
        entityId: event.entityId,
        payload: JSON.stringify(event.payload),
        createdAt: timestamp,
      });
    },
  };
}
