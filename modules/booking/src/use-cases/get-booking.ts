import type { BookingRepository } from "../ports";

export async function getBooking(input: { id: string }, deps: { bookingRepository: BookingRepository }) {
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

  return {
    ok: true,
    status: 200,
    data: { booking }
  };
}
