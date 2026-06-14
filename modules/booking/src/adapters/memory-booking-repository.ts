import type { AvailabilitySlot, Booking, DomainEvent, Service } from "../types";
import type { BookingRepository } from "../ports";

function now() {
  return new Date().toISOString();
}

function bookingOverlaps(
  booking: Booking,
  slot: {
    serviceId: string;
    startsAt: string;
    endsAt: string;
  }
) {
  return (
    booking.serviceId === slot.serviceId &&
    booking.status === "confirmed" &&
    booking.startsAt < slot.endsAt &&
    booking.endsAt > slot.startsAt
  );
}

const defaultServices: Service[] = [
  {
    id: "svc-consultation",
    name: "Consultation",
    description: "A focused appointment for discovery calls, clinics, studios, or consultants.",
    durationMinutes: 60,
    priceCents: 0,
    currency: "USD",
    status: "active"
  },
  {
    id: "svc-standard",
    name: "Standard Service",
    description: "A flexible service slot for local operators.",
    durationMinutes: 45,
    priceCents: 0,
    currency: "USD",
    status: "active"
  }
];

export function createMemoryBookingRepository(): BookingRepository {
  const bookings = new Map<string, Booking>();
  const events: DomainEvent[] = [];

  return {
    async listServices() {
      return defaultServices;
    },

    async getService(serviceId) {
      return defaultServices.find((service) => service.id === serviceId) ?? null;
    },

    async findAvailability(input) {
      const service = defaultServices.find((item) => item.id === input.serviceId) ?? defaultServices[0];
      const base = new Date(`${input.date}T09:00:00.000Z`);
      const slots: AvailabilitySlot[] = [];

      for (let index = 0; index < 8; index += 1) {
        const starts = new Date(base.getTime() + index * 60 * 60_000);
        const ends = new Date(starts.getTime() + service.durationMinutes * 60_000);
        const startsAt = starts.toISOString();
        const endsAt = ends.toISOString();
        const occupied = [...bookings.values()].some((booking) =>
          bookingOverlaps(booking, { serviceId: input.serviceId, startsAt, endsAt })
        );

        slots.push({
          serviceId: input.serviceId,
          startsAt,
          endsAt,
          available: !occupied
        });
      }

      return slots;
    },

    async isSlotAvailable(input) {
      return ![...bookings.values()].some((booking) => bookingOverlaps(booking, input));
    },

    async createBooking(input) {
      const timestamp = now();
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
      bookings.set(booking.id, booking);
      return booking;
    },

    async listBookings() {
      return [...bookings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },

    async getBooking(id) {
      return bookings.get(id) ?? null;
    },

    async cancelBooking(id) {
      const existing = bookings.get(id);
      if (!existing) return null;
      const updated: Booking = { ...existing, status: "cancelled", updatedAt: now() };
      bookings.set(id, updated);
      return updated;
    },

    async writeEvent(event) {
      events.push(event);
    }
  };
}
