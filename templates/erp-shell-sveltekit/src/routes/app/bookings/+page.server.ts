import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listBookings, cancelBooking } from "@microservices-sh/booking";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/booking: the company's appointments. Each
// booking denormalizes its customer + service names, so display needs no joins.
// Creating bookings requires seeded services and an availability slot (there is
// no create-service use-case in the module), so the create flow is out of this
// admin sample — it lists and cancels.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("booking", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const result = await listBookings({ bookingRepository: locals.bookingRepository });
  const bookings = result.ok ? result.data.bookings : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    // Never expose accessToken (per-booking secret).
    bookings: bookings.map((b) => ({
      id: b.id,
      customerName: b.customerName,
      serviceName: b.serviceName,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: b.status
    }))
  };
};

export const actions: Actions = {
  cancel: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const id = String((await request.formData()).get("id") ?? "").trim();
    if (!id) return fail(400, { error: "Missing booking." });

    const result = await cancelBooking({ id }, { bookingRepository: locals.bookingRepository });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not cancel the booking." });

    await recordEvent(
      { eventName: "booking.cancelled", actorId: locals.user.id, entityType: "booking", entityId: id, source: "app/bookings", payload: {} },
      { auditStore: locals.auditStore }
    );
    return { ok: true, cancelled: true };
  }
};
