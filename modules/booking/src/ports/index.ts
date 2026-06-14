import type { AvailabilitySlot, Booking, DomainEvent, Service } from "../types";

export interface BookingRepository {
  listServices(): Promise<Service[]>;
  getService(serviceId: string): Promise<Service | null>;
  findAvailability(input: { serviceId: string; date: string }): Promise<AvailabilitySlot[]>;
  isSlotAvailable(input: { serviceId: string; startsAt: string; endsAt: string }): Promise<boolean>;
  createBooking(input: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    serviceId: string;
    serviceName: string;
    startsAt: string;
    endsAt: string;
    notes?: string | null;
  }): Promise<Booking>;
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  cancelBooking(id: string): Promise<Booking | null>;
  writeEvent(event: DomainEvent): Promise<void>;
}

export interface IdGenerator {
  create(prefix: string): string;
}

export interface Clock {
  now(): Date;
}
