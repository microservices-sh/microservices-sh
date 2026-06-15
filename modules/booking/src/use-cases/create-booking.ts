import { upsertCustomer } from "@microservices-sh/customer";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createBookingSchema } from "../schemas";
import { afterBookingConfirmed, beforeBookingCreate } from "../hooks";
import type { BookingRepository, Clock, IdGenerator } from "../ports";
import type { Actor, Booking } from "../types";

const defaultClock: Clock = {
  now: () => new Date()
};

const defaultIdGenerator: IdGenerator = {
  create: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
};

function isBookingConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /constraint|unique/i.test(message);
}

function slotUnavailable() {
  return {
    ok: false,
    status: 409,
    error: {
      code: "SLOT_UNAVAILABLE",
      message: "The selected time is no longer available."
    }
  };
}

export async function createBooking(
  input: unknown,
  deps: {
    bookingRepository: BookingRepository;
    customerRepository: CustomerRepository;
    actor?: Actor | null;
    clock?: Clock;
    idGenerator?: IdGenerator;
  }
) {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_BOOKING_INPUT",
        message: "Booking input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const draft = await beforeBookingCreate(parsed.data);
  const service = await deps.bookingRepository.getService(draft.serviceId);
  if (!service || service.status !== "active") {
    return {
      ok: false,
      status: 404,
      error: {
        code: "SERVICE_NOT_FOUND",
        message: "The selected service is not available."
      }
    };
  }

  const startsAt = new Date(draft.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000).toISOString();
  const available = await deps.bookingRepository.isSlotAvailable({
    serviceId: service.id,
    startsAt: draft.startsAt,
    endsAt
  });

  if (!available) {
    return slotUnavailable();
  }

  const customerResult = await upsertCustomer(
    {
      name: draft.customerName,
      email: draft.customerEmail,
      phone: draft.customerPhone ?? null,
      notes: null
    },
    {
      customerRepository: deps.customerRepository,
      actor: deps.actor
    }
  );

  if (!customerResult.ok || !customerResult.data) {
    // Re-shape into a booking error rather than returning the customer result
    // verbatim, so createBooking's return type stays a clean booking result
    // (the caller narrows on "error" in result without seeing customer shapes).
    return {
      ok: false,
      status: customerResult.status,
      error:
        "error" in customerResult
          ? customerResult.error
          : { code: "CUSTOMER_UPSERT_FAILED", message: "Could not save the customer for this booking." }
    };
  }

  const { customer } = customerResult.data;

  let booking: Booking;
  try {
    booking = await deps.bookingRepository.createBooking({
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      serviceId: service.id,
      serviceName: service.name,
      startsAt: draft.startsAt,
      endsAt,
      notes: draft.notes ?? null
    });
  } catch (error) {
    if (!isBookingConflict(error)) throw error;
    return slotUnavailable();
  }

  await deps.bookingRepository.writeEvent({
    eventName: "booking.confirmed",
    entityType: "booking",
    entityId: booking.id,
    payload: {
      actorId: deps.actor?.id ?? null,
      customerId: customer.id,
      serviceId: service.id,
      startsAt: booking.startsAt
    }
  });

  await afterBookingConfirmed({ booking });

  return {
    ok: true,
    status: 201,
    data: {
      booking,
      generatedAt: (deps.clock ?? defaultClock).now().toISOString(),
      idStrategy: (deps.idGenerator ?? defaultIdGenerator).create("preview")
    }
  };
}
