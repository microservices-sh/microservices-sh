import type { BookingRepository } from "../ports";

export async function listBookings(deps: { bookingRepository: BookingRepository }) {
  const bookings = await deps.bookingRepository.listBookings();
  return {
    ok: true,
    status: 200,
    data: { bookings }
  };
}
