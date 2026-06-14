import type { AvailabilitySlot, Booking, DomainEvent, Service } from "../types";
import type { BookingRepository } from "../ports";

function rowToService(row: Record<string, unknown>): Service {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    durationMinutes: Number(row.duration_minutes),
    priceCents: Number(row.price_cents),
    currency: String(row.currency),
    status: row.status === "inactive" ? "inactive" : "active"
  };
}

function rowToBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name ?? row.service_id),
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status === "cancelled" ? "cancelled" : "confirmed",
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1BookingRepository(db: D1Database): BookingRepository {
  return {
    async listServices() {
      const result = await db
        .prepare("SELECT id, name, description, duration_minutes, price_cents, currency, status FROM services WHERE status = 'active' ORDER BY name")
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToService);
    },

    async getService(serviceId) {
      const row = await db
        .prepare("SELECT id, name, description, duration_minutes, price_cents, currency, status FROM services WHERE id = ?")
        .bind(serviceId)
        .first<Record<string, unknown>>();
      return row ? rowToService(row) : null;
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
          endsAt: ends.toISOString()
        });
        slots.push({
          serviceId: input.serviceId,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          available
        });
      }

      return slots;
    },

    async isSlotAvailable(input) {
      const row = await db
        .prepare("SELECT id FROM bookings WHERE service_id = ? AND status = 'confirmed' AND starts_at < ? AND ends_at > ? LIMIT 1")
        .bind(input.serviceId, input.endsAt, input.startsAt)
        .first();
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
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await db
        .prepare(
          "INSERT INTO bookings (id, customer_id, service_id, starts_at, ends_at, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          booking.id,
          booking.customerId,
          booking.serviceId,
          booking.startsAt,
          booking.endsAt,
          booking.status,
          booking.notes,
          booking.createdAt,
          booking.updatedAt
        )
        .run();
      return booking;
    },

    async listBookings() {
      const result = await db
        .prepare(
          "SELECT b.*, s.name AS service_name, c.name AS customer_name, c.email AS customer_email FROM bookings b JOIN services s ON s.id = b.service_id JOIN customers c ON c.id = b.customer_id ORDER BY b.starts_at DESC LIMIT 100"
        )
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToBooking);
    },

    async getBooking(id) {
      const row = await db
        .prepare(
          "SELECT b.*, s.name AS service_name, c.name AS customer_name, c.email AS customer_email FROM bookings b JOIN services s ON s.id = b.service_id JOIN customers c ON c.id = b.customer_id WHERE b.id = ?"
        )
        .bind(id)
        .first<Record<string, unknown>>();
      return row ? rowToBooking(row) : null;
    },

    async cancelBooking(id) {
      const timestamp = new Date().toISOString();
      await db
        .prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .bind(timestamp, id)
        .run();
      return this.getBooking(id);
    },

    async writeEvent(event: DomainEvent) {
      const timestamp = new Date().toISOString();
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(`evt_${crypto.randomUUID().slice(0, 12)}`, event.eventName, event.entityType, event.entityId, JSON.stringify(event.payload), timestamp)
        .run();
      await db
        .prepare("INSERT INTO audit_events (id, event_name, actor_id, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(`aud_${crypto.randomUUID().slice(0, 12)}`, event.eventName, String(event.payload.actorId ?? ""), event.entityType, event.entityId, JSON.stringify(event.payload), timestamp)
        .run();
    }
  };
}
