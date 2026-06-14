import type { AvailabilitySlot, Booking } from "./types";
import type { CreateBookingInput } from "./schemas";

export async function calculateAvailability(input: {
  slots: AvailabilitySlot[];
  serviceId: string;
  date: string;
}) {
  return input.slots;
}

export async function beforeBookingCreate(input: CreateBookingInput) {
  return input;
}

export async function afterBookingConfirmed(input: { booking: Booking }) {
  return input;
}

export async function beforeBookingCancel(input: { bookingId: string; reason?: string }) {
  return input;
}
