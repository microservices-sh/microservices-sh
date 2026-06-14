export type BookingStatus = "confirmed" | "cancelled";

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  status: "active" | "inactive";
}

export interface Booking {
  id: string;
  customerId: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlot {
  serviceId: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface Actor {
  id: string;
  email?: string;
  isAdmin?: boolean;
}

export interface DomainEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}
