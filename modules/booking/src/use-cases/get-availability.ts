import { availabilityQuerySchema } from "../schemas";
import { calculateAvailability } from "../hooks";
import type { BookingRepository } from "../ports";

export async function getAvailability(input: unknown, deps: { bookingRepository: BookingRepository }) {
  const parsed = availabilityQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_AVAILABILITY_QUERY",
        message: "Availability query is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const slots = await deps.bookingRepository.findAvailability(parsed.data);
  const adjustedSlots = await calculateAvailability({
    slots,
    serviceId: parsed.data.serviceId,
    date: parsed.data.date
  });

  return {
    ok: true,
    status: 200,
    data: {
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      slots: adjustedSlots
    }
  };
}
