import { afterBookingCancelled, beforeBookingCancel } from "../hooks";
import type { BookingRepository } from "../ports";
import type { Actor } from "../types";

export async function cancelBooking(
  input: { id: string; reason?: string },
  deps: {
    bookingRepository: BookingRepository;
    actor?: Actor | null;
  }
) {
  const booking = await deps.bookingRepository.getBooking(input.id);
  if (!booking) {
    return {
      ok: false,
      status: 404,
      error: {
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found."
      }
    };
  }

  if (booking.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: {
        code: "BOOKING_NOT_CANCELLABLE",
        message: "Booking is already cancelled."
      }
    };
  }

  await beforeBookingCancel({ bookingId: input.id, reason: input.reason });

  const cancelled = await deps.bookingRepository.cancelBooking(input.id);
  if (!cancelled) {
    return {
      ok: false,
      status: 404,
      error: {
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found."
      }
    };
  }

  await deps.bookingRepository.writeEvent({
    eventName: "booking.cancelled",
    entityType: "booking",
    entityId: cancelled.id,
    payload: {
      actorId: deps.actor?.id ?? null,
      customerId: cancelled.customerId,
      serviceId: cancelled.serviceId,
      reason: input.reason ?? null
    }
  });

  await afterBookingCancelled({ booking: cancelled });

  return {
    ok: true,
    status: 200,
    data: { booking: cancelled }
  };
}
