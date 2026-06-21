import { describe, expect, it } from "vitest";
import { createMembershipCreditsMemoryStore, createMembershipCreditsService, createSequentialMembershipCreditsIdFactory } from "./index";

const ctx = {
  tenantId: "tenant_1",
  actorId: "admin_1",
  now: "2026-06-21T00:00:00.000Z"
};
const laterCtx = {
  ...ctx,
  now: "2026-06-21T00:05:00.000Z"
};

function createService() {
  const store = createMembershipCreditsMemoryStore();
  const createId = createSequentialMembershipCreditsIdFactory();
  return createMembershipCreditsService({ store, createId, defaultCurrency: "hkd" });
}

describe("membership-credits", () => {
  it("creates tiers, assigns a membership, changes tier, and records history", async () => {
    const service = createService();
    const free = await service.createMembershipTier(ctx, {
      name: "Free",
      slug: "Free Tier",
      isFree: true,
      isDefault: true,
      level: 0
    });
    const pro = await service.createMembershipTier(ctx, {
      name: "Pro",
      slug: "pro",
      level: 2,
      discountBasisPoints: 1500,
      priceMonthlyCents: 12000,
      benefits: ["Priority booking"]
    });
    expect(free.data!.slug).toBe("free-tier");

    const assigned = await service.assignMembership(ctx, {
      customerId: "cus_1",
      tierId: free.data!.id,
      reason: "Signup default"
    });
    expect(assigned.ok).toBe(true);
    expect(assigned.data!.id).toBe("mcmem_000001");

    const duplicate = await service.assignMembership(ctx, {
      customerId: "cus_1",
      tierId: pro.data!.id
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error?.code).toBe("active_membership_exists");

    const changed = await service.changeMembershipTier(laterCtx, {
      customerId: "cus_1",
      tierId: pro.data!.id,
      reason: "Paid upgrade"
    });
    expect(changed.data).toEqual(expect.objectContaining({ tierId: pro.data!.id, previousTierId: free.data!.id }));

    const snapshot = await service.getCustomerMembershipSnapshot(ctx, "cus_1");
    expect(snapshot.data!.tier).toEqual(expect.objectContaining({ name: "Pro", discountBasisPoints: 1500 }));
    expect(snapshot.data!.membershipHistory.map((entry) => entry.action)).toEqual(["upgraded", "created"]);
  });

  it("keeps a cents-based credit ledger and blocks overdrafts", async () => {
    const service = createService();
    const grant = await service.grantCustomerCredit(ctx, {
      customerId: "cus_1",
      amountCents: 5000,
      description: "Admin goodwill"
    });
    expect(grant.data!.balance.balanceCents).toBe(5000);
    expect(grant.data!.transaction.id).toBe("mctx_000001");

    const applied = await service.applyCreditToBooking(laterCtx, {
      customerId: "cus_1",
      amountCents: 3000,
      description: "Booking paid with credits",
      referenceType: "booking",
      referenceId: "book_1"
    });
    expect(applied.data!.balance).toEqual(expect.objectContaining({ balanceCents: 2000, totalUsedCents: 3000 }));

    const replay = await service.applyCreditToBooking(laterCtx, {
      customerId: "cus_1",
      amountCents: 3000,
      description: "Booking paid with credits",
      referenceType: "booking",
      referenceId: "book_1"
    });
    expect(replay.data!.transaction.id).toBe(applied.data!.transaction.id);
    expect(replay.data!.balance.balanceCents).toBe(2000);

    const overdraft = await service.debitCustomerCredit(ctx, {
      customerId: "cus_1",
      amountCents: 3000,
      description: "Manual debit"
    });
    expect(overdraft.ok).toBe(false);
    expect(overdraft.error?.code).toBe("insufficient_credit_balance");

    const ledger = await service.getCustomerCreditLedger(ctx, { customerId: "cus_1" });
    expect(ledger.data!.transactions.map((tx) => tx.source)).toEqual(["booking_payment", "admin_grant"]);
  });

  it("expires due active memberships", async () => {
    const service = createService();
    const tier = await service.createMembershipTier(ctx, { name: "Monthly", slug: "monthly", level: 1 });
    await service.assignMembership(ctx, {
      customerId: "cus_1",
      tierId: tier.data!.id,
      subscriptionType: "monthly",
      startedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-01T00:00:00.000Z"
    });

    const expired = await service.expireMemberships(ctx, {
      asOf: "2026-06-21T00:00:00.000Z"
    });
    expect(expired.data).toEqual([expect.objectContaining({ status: "expired" })]);

    const snapshot = await service.getCustomerMembershipSnapshot(ctx, "cus_1");
    expect(snapshot.data!.membership).toBeNull();
  });
});
