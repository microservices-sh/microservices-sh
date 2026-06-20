import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listBookings } from "@microservices-sh/booking";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/booking: the company's appointments. Each
// booking denormalizes its customer + service names, so display needs no joins.
// Creating bookings requires seeded services and an availability slot (there is
// no create-service use-case in the module), so the create flow is out of this
// admin sample — it lists; cancelling moved to the booking detail page.
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
