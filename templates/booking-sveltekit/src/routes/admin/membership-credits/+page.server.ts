import type { Actions, PageServerLoad } from "./$types";
import { fail as formFail } from "@sveltejs/kit";
import { listCustomers } from "@microservices-sh/customer";
import { getMembershipCreditsModuleStatus } from "@microservices-sh/membership-credits";
import {
  membershipCreditsContext,
  membershipCreditsService
} from "$lib/server/membership-credits";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optionalText(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value ? value : null;
}

function cents(form: FormData, key: string): number | null {
  const raw = text(form, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function integer(form: FormData, key: string): number | undefined {
  const value = Number(text(form, key));
  return Number.isInteger(value) ? value : undefined;
}

function dateTime(form: FormData, key: string): string {
  const value = text(form, key);
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function benefits(form: FormData): string[] {
  return text(form, "benefits")
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function actionError(result: { error?: { message: string } }, fallback: string) {
  return formFail(400, { error: result.error?.message ?? fallback });
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  const service = await membershipCreditsService(locals, platform?.env?.DB);
  const ctx = membershipCreditsContext(locals);
  const [tiersResult, customersResult] = await Promise.all([
    service.listMembershipTiers(ctx),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);
  const customers = customersResult.data.customers;
  const snapshots = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      snapshot: await service.getCustomerMembershipSnapshot(ctx, customer.id)
    }))
  );
  const customerSummaries = snapshots.map(({ customer, snapshot }) => ({
    customer,
    snapshot: snapshot.ok ? snapshot.data : null
  }));
  const totalCreditCents = customerSummaries.reduce(
    (sum, row) => sum + (row.snapshot?.creditBalance.balanceCents ?? 0),
    0
  );
  const activeMemberships = customerSummaries.filter((row) => row.snapshot?.membership?.status === "active").length;

  return {
    status: getMembershipCreditsModuleStatus(),
    tiers: tiersResult.ok ? tiersResult.data : [],
    customers: customerSummaries,
    metrics: {
      tiers: tiersResult.ok ? tiersResult.data.length : 0,
      activeMemberships,
      totalCreditCents
    }
  };
};

export const actions: Actions = {
  createTier: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).createMembershipTier(
      membershipCreditsContext(locals),
      {
        name: text(form, "name"),
        slug: text(form, "slug") || text(form, "name"),
        description: optionalText(form, "description"),
        level: integer(form, "level") ?? 0,
        discountBasisPoints: integer(form, "discountBasisPoints") ?? 0,
        isFree: form.get("isFree") === "on",
        isDefault: form.get("isDefault") === "on",
        priceMonthlyCents: cents(form, "priceMonthly"),
        priceYearlyCents: cents(form, "priceYearly"),
        priceLifetimeCents: cents(form, "priceLifetime"),
        benefits: benefits(form),
        status: "active",
        position: integer(form, "position") ?? 0
      }
    );

    if (!result.ok) return actionError(result, "Tier could not be created.");
    return { success: "Membership tier created." };
  },

  expireMemberships: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const result = await (await membershipCreditsService(locals, platform?.env?.DB)).expireMemberships(
      membershipCreditsContext(locals),
      {
        asOf: dateTime(form, "asOf"),
        limit: integer(form, "limit") ?? 100
      }
    );

    if (!result.ok) return actionError(result, "Membership expiry job failed.");
    return { success: `${result.data?.length ?? 0} memberships expired.` };
  }
};
