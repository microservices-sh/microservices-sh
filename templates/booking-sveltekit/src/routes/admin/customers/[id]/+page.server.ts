import type { Actions, PageServerLoad } from "./$types";
import { error, fail as formFail } from "@sveltejs/kit";
import { listBookings } from "@microservices-sh/booking";
import { getCustomer } from "@microservices-sh/customer";
import { getMembershipCreditsModuleStatus, type MembershipSubscriptionType } from "@microservices-sh/membership-credits";
import {
  membershipCreditsContext,
  membershipCreditsService
} from "$lib/server/membership-credits";

const SUBSCRIPTION_TYPES = new Set(["manual", "monthly", "yearly", "lifetime"]);

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optionalText(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value ? value : null;
}

function dateText(form: FormData, key: string): string | undefined {
  const value = text(form, key);
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function cents(form: FormData, key: string): number {
  const value = Number(text(form, key));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function integer(form: FormData, key: string): number | undefined {
  const value = Number(text(form, key));
  return Number.isInteger(value) ? value : undefined;
}

function benefits(form: FormData): string[] {
  return text(form, "benefits")
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function subscriptionType(form: FormData): MembershipSubscriptionType {
  const value = text(form, "subscriptionType");
  return SUBSCRIPTION_TYPES.has(value) ? (value as MembershipSubscriptionType) : "manual";
}

function actionError(result: { error?: { message: string } }, fallback: string) {
  return formFail(400, { error: result.error?.message ?? fallback });
}

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const [customerResult, bookingsResult] = await Promise.all([
    getCustomer({ id: params.id }, { customerRepository: locals.customerRepository }),
    listBookings({ bookingRepository: locals.bookingRepository })
  ]);

  if (!customerResult.ok) {
    throw error(customerResult.status, "Customer not found");
  }

  const membershipService = await membershipCreditsService(locals, platform?.env?.DB);
  const ctx = membershipCreditsContext(locals);
  const [tiersResult, snapshotResult] = await Promise.all([
    membershipService.listMembershipTiers(ctx),
    membershipService.getCustomerMembershipSnapshot(ctx, params.id)
  ]);

  return {
    customer: customerResult.data.customer,
    bookings: bookingsResult.data.bookings.filter((booking) => booking.customerId === params.id),
    membershipCreditsStatus: getMembershipCreditsModuleStatus(),
    membershipTiers: tiersResult.ok ? tiersResult.data : [],
    membershipSnapshot: snapshotResult.ok ? snapshotResult.data : null
  };
};

export const actions: Actions = {
  createTier: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).createMembershipTier(membershipCreditsContext(locals), {
      name: text(form, "name"),
      slug: text(form, "slug") || text(form, "name"),
      description: optionalText(form, "description"),
      level: integer(form, "level") ?? 0,
      discountBasisPoints: integer(form, "discountBasisPoints") ?? 0,
      isFree: form.get("isFree") === "on",
      isDefault: form.get("isDefault") === "on",
      priceMonthlyCents: cents(form, "priceMonthly"),
      priceYearlyCents: cents(form, "priceYearly") || null,
      benefits: benefits(form),
      status: "active",
      position: integer(form, "position") ?? 0
    });

    if (!result.ok) return actionError(result, "Tier could not be created.");
    return { success: "Membership tier created." };
  },

  assignMembership: async ({ request, params, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).assignMembership(membershipCreditsContext(locals), {
      customerId: params.id,
      tierId: text(form, "tierId"),
      subscriptionType: subscriptionType(form),
      startedAt: dateText(form, "startedAt"),
      expiresAt: dateText(form, "expiresAt") ?? null,
      autoRenew: form.get("autoRenew") === "on",
      source: "booking-admin",
      reason: optionalText(form, "reason")
    });

    if (!result.ok) return actionError(result, "Membership could not be assigned.");
    return { success: "Membership assigned." };
  },

  changeMembershipTier: async ({ request, params, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).changeMembershipTier(membershipCreditsContext(locals), {
      customerId: params.id,
      tierId: text(form, "tierId"),
      reason: optionalText(form, "reason")
    });

    if (!result.ok) return actionError(result, "Membership tier could not be changed.");
    return { success: "Membership tier changed." };
  },

  cancelMembership: async ({ request, params, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).cancelMembership(membershipCreditsContext(locals), {
      customerId: params.id,
      reason: optionalText(form, "reason") ?? "Cancelled from booking admin."
    });

    if (!result.ok) return actionError(result, "Membership could not be cancelled.");
    return { success: "Membership cancelled." };
  },

  grantCustomerCredit: async ({ request, params, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).grantCustomerCredit(membershipCreditsContext(locals), {
      customerId: params.id,
      amountCents: cents(form, "amount"),
      description: text(form, "description"),
      referenceType: optionalText(form, "referenceType"),
      referenceId: optionalText(form, "referenceId")
    });

    if (!result.ok) return actionError(result, "Credit could not be granted.");
    return { success: "Credit granted." };
  },

  debitCustomerCredit: async ({ request, params, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).debitCustomerCredit(membershipCreditsContext(locals), {
      customerId: params.id,
      amountCents: cents(form, "amount"),
      description: text(form, "description"),
      referenceType: optionalText(form, "referenceType"),
      referenceId: optionalText(form, "referenceId")
    });

    if (!result.ok) return actionError(result, "Credit could not be debited.");
    return { success: "Credit debited." };
  }
};
