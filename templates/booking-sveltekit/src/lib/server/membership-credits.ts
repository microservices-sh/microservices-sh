import {
  createMembershipCreditsService,
  type MembershipCreditsService,
  type TenantContext
} from "@microservices-sh/membership-credits";
import { getCompanySettings } from "$lib/server/settings";

export const MEMBERSHIP_CREDITS_TENANT_ID = "booking-template";

export function membershipCreditsContext(locals: App.Locals): TenantContext {
  return {
    tenantId: MEMBERSHIP_CREDITS_TENANT_ID,
    actorId: locals.user?.id ?? "local-admin"
  };
}

export async function membershipCreditsService(
  locals: App.Locals,
  d1: D1Database | undefined
): Promise<MembershipCreditsService> {
  const settings = await getCompanySettings(d1);
  return createMembershipCreditsService({
    store: locals.membershipCreditsStore,
    defaultCurrency: settings.currency.toLowerCase()
  });
}
