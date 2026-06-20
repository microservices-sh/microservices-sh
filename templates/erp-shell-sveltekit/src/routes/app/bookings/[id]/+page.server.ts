import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { getBooking, cancelBooking } from "@microservices-sh/booking";
import { getCustomer } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const statusTone = (s: string): Tone =>
  s === "confirmed" ? "good" : s === "cancelled" ? "bad" : s === "pending" ? "warn" : "neutral";

const eventTone = (e: string): Tone => {
  if (e.includes("confirmed") || e.includes("created")) return "info";
  if (e.includes("cancelled") || e.includes("failed")) return "bad";
  return "neutral";
};

const when = (iso: string) => new Date(iso).toLocaleString();

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("booking", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const [bookingResult, eventsResult] = await Promise.all([
    getBooking({ id: params.id }, { bookingRepository: locals.bookingRepository }),
    listEvents({ entityType: "booking", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);
  if (!bookingResult.ok || !bookingResult.data) throw error(404, "Booking not found");
  const booking = bookingResult.data.booking;

  // Link the customer when it resolves; the booking denormalizes the name anyway.
  const cust = booking.customerId
    ? await getCustomer({ id: booking.customerId }, { customerRepository: locals.customerRepository })
    : null;
  const customerName = cust?.ok && cust.data ? cust.data.customer.name : booking.customerName;

  const events = eventsResult.ok ? eventsResult.data.events : [];

  return {
    canManage,
    booking: {
      id: booking.id,
      customerId: booking.customerId,
      customerName,
      serviceName: booking.serviceName,
      status: booking.status,
      tone: statusTone(booking.status),
      isCancelled: booking.status === "cancelled",
      starts: when(booking.startsAt),
      ends: when(booking.endsAt),
      notes: booking.notes,
      created: booking.createdAt ? relativeTime(booking.createdAt, now) : null
    },
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  cancel: async ({ params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const id = params.id;
    const result = await cancelBooking({ id }, { bookingRepository: locals.bookingRepository });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not cancel the booking." });

    await recordEvent(
      { eventName: "booking.cancelled", actorId: locals.user.id, entityType: "booking", entityId: id, source: "app/bookings/detail", payload: {} },
      { auditStore: locals.auditStore }
    );
    return { ok: true, cancelled: true };
  }
};
