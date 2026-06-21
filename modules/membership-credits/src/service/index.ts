import type { MembershipCreditsStore, MembershipListFilter } from "../ports";
import type {
  AssignMembershipInput,
  CancelMembershipInput,
  ChangeMembershipTierInput,
  CreateMembershipTierInput,
  CreditLedgerFilter,
  CreditOperationInput,
  CreditSource,
  CreditTransaction,
  CreditTransactionType,
  CustomerCreditBalance,
  CustomerMembership,
  CustomerMembershipSnapshot,
  ExpireMembershipsInput,
  MembershipCreditsIdFactory,
  MembershipCreditsIdPrefix,
  MembershipHistoryAction,
  MembershipHistoryEntry,
  MembershipTier,
  ModuleResult,
  TenantContext
} from "../types";

export interface MembershipCreditsServiceDeps {
  store: MembershipCreditsStore;
  createId?: MembershipCreditsIdFactory;
  defaultCurrency?: string;
}

export interface MembershipCreditsService {
  createMembershipTier(ctx: TenantContext, input: CreateMembershipTierInput): Promise<ModuleResult<MembershipTier>>;
  listMembershipTiers(ctx: TenantContext): Promise<ModuleResult<MembershipTier[]>>;
  assignMembership(ctx: TenantContext, input: AssignMembershipInput): Promise<ModuleResult<CustomerMembership>>;
  changeMembershipTier(ctx: TenantContext, input: ChangeMembershipTierInput): Promise<ModuleResult<CustomerMembership>>;
  cancelMembership(ctx: TenantContext, input: CancelMembershipInput): Promise<ModuleResult<CustomerMembership>>;
  expireMemberships(ctx: TenantContext, input: ExpireMembershipsInput): Promise<ModuleResult<CustomerMembership[]>>;
  getCustomerMembershipSnapshot(ctx: TenantContext, customerId: string): Promise<ModuleResult<CustomerMembershipSnapshot>>;
  grantCustomerCredit(ctx: TenantContext, input: CreditOperationInput): Promise<ModuleResult<{ balance: CustomerCreditBalance; transaction: CreditTransaction }>>;
  debitCustomerCredit(ctx: TenantContext, input: CreditOperationInput): Promise<ModuleResult<{ balance: CustomerCreditBalance; transaction: CreditTransaction }>>;
  applyCreditToBooking(ctx: TenantContext, input: CreditOperationInput): Promise<ModuleResult<{ balance: CustomerCreditBalance; transaction: CreditTransaction }>>;
  refundBookingToCredit(ctx: TenantContext, input: CreditOperationInput): Promise<ModuleResult<{ balance: CustomerCreditBalance; transaction: CreditTransaction }>>;
  getCustomerCreditLedger(ctx: TenantContext, filter: CreditLedgerFilter): Promise<ModuleResult<{ transactions: CreditTransaction[]; total: number }>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialMembershipCreditsIdFactory(): MembershipCreditsIdFactory {
  const sequences: Record<MembershipCreditsIdPrefix, number> = { mctier: 0, mcmem: 0, mcbal: 0, mctx: 0, mchist: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: MembershipCreditsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function positiveCents(amountCents: number): number {
  return Number.isInteger(amountCents) && amountCents > 0 ? amountCents : 0;
}

function nullableTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function defaultBalance(ctx: TenantContext, customerId: string, createId: MembershipCreditsIdFactory, currency: string, timestamp: string): CustomerCreditBalance {
  return {
    id: createId("mcbal"),
    tenantId: ctx.tenantId,
    customerId,
    balanceCents: 0,
    totalCreditedCents: 0,
    totalUsedCents: 0,
    currency,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function addHistory(
  store: MembershipCreditsStore,
  ctx: TenantContext,
  createId: MembershipCreditsIdFactory,
  membershipId: string,
  action: MembershipHistoryAction,
  fromTierId: string | null,
  toTierId: string | null,
  reason?: string | null,
  metadata: Record<string, unknown> = {}
) {
  const entry: MembershipHistoryEntry = {
    id: createId("mchist"),
    tenantId: ctx.tenantId,
    membershipId,
    fromTierId,
    toTierId,
    action,
    reason: nullableTrim(reason),
    performedBy: ctx.actorId ?? null,
    metadata,
    createdAt: now(ctx)
  };
  await store.insertMembershipHistory(entry);
  return entry;
}

export function createMembershipCreditsService(deps: MembershipCreditsServiceDeps): MembershipCreditsService {
  const createId = deps.createId ?? defaultId;
  const defaultCurrency = deps.defaultCurrency ?? "usd";

  async function getOrCreateBalance(ctx: TenantContext, customerId: string): Promise<CustomerCreditBalance> {
    const existing = await deps.store.getCreditBalance(ctx.tenantId, customerId);
    if (existing) return existing;
    const balance = defaultBalance(ctx, customerId, createId, defaultCurrency, now(ctx));
    await deps.store.upsertCreditBalance(balance);
    return balance;
  }

  async function moveCredit(
    ctx: TenantContext,
    input: CreditOperationInput,
    type: CreditTransactionType,
    source: CreditSource
  ): Promise<ModuleResult<{ balance: CustomerCreditBalance; transaction: CreditTransaction }>> {
    const amountCents = positiveCents(input.amountCents);
    if (!input.customerId.trim()) return fail("customer_required", "Credit operation requires a customer id.");
    if (!amountCents) return fail("amount_required", "Credit amount must be a positive integer number of cents.");
    if (!input.description.trim()) return fail("description_required", "Credit operation requires a description.");
    if (input.referenceId) {
      const existing = await deps.store.findCreditTransactionByReference(
        ctx.tenantId,
        input.customerId,
        type,
        source,
        input.referenceType ?? null,
        input.referenceId
      );
      if (existing) {
        const balance = await getOrCreateBalance(ctx, input.customerId);
        return ok({ balance, transaction: existing });
      }
    }
    const current = await getOrCreateBalance(ctx, input.customerId);
    if (type === "debit" && current.balanceCents < amountCents) {
      return fail("insufficient_credit_balance", "Customer credit balance is too low.");
    }
    const timestamp = now(ctx);
    const balanceAfter = type === "credit" ? current.balanceCents + amountCents : current.balanceCents - amountCents;
    const updated: CustomerCreditBalance = {
      ...current,
      balanceCents: balanceAfter,
      totalCreditedCents: type === "credit" ? current.totalCreditedCents + amountCents : current.totalCreditedCents,
      totalUsedCents: type === "debit" ? current.totalUsedCents + amountCents : current.totalUsedCents,
      updatedAt: timestamp
    };
    const transaction: CreditTransaction = {
      id: createId("mctx"),
      tenantId: ctx.tenantId,
      customerId: input.customerId,
      type,
      amountCents,
      balanceBeforeCents: current.balanceCents,
      balanceAfterCents: balanceAfter,
      source,
      referenceType: nullableTrim(input.referenceType),
      referenceId: nullableTrim(input.referenceId),
      description: input.description.trim(),
      performedBy: ctx.actorId ?? null,
      createdAt: timestamp
    };
    await deps.store.upsertCreditBalance(updated);
    await deps.store.insertCreditTransaction(transaction);
    return ok({ balance: updated, transaction });
  }

  return {
    async createMembershipTier(ctx, input) {
      const slug = normalizeSlug(input.slug);
      if (!input.name.trim()) return fail("tier_name_required", "Membership tier name is required.");
      if (!slug) return fail("tier_slug_required", "Membership tier slug is required.");
      if (await deps.store.getTierBySlug(ctx.tenantId, slug)) return fail("tier_slug_exists", "Membership tier slug already exists.");
      const timestamp = now(ctx);
      const tier: MembershipTier = {
        id: createId("mctier"),
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        slug,
        description: nullableTrim(input.description),
        level: input.level ?? 0,
        discountBasisPoints: input.discountBasisPoints ?? 0,
        isFree: input.isFree ?? false,
        isDefault: input.isDefault ?? false,
        priceMonthlyCents: input.priceMonthlyCents ?? null,
        priceYearlyCents: input.priceYearlyCents ?? null,
        priceLifetimeCents: input.priceLifetimeCents ?? null,
        currency: input.currency ?? defaultCurrency,
        benefits: cleanList(input.benefits),
        badgeColor: nullableTrim(input.badgeColor),
        badgeIcon: nullableTrim(input.badgeIcon),
        maxAdvanceBookingDays: input.maxAdvanceBookingDays ?? null,
        maxBookingsPerMonth: input.maxBookingsPerMonth ?? null,
        priorityBookingHours: input.priorityBookingHours ?? 0,
        status: input.status ?? "active",
        position: input.position ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertTier(tier);
      return ok(tier);
    },

    async listMembershipTiers(ctx) {
      return ok(await deps.store.listTiers(ctx.tenantId));
    },

    async assignMembership(ctx, input) {
      const tier = await deps.store.getTier(ctx.tenantId, input.tierId);
      if (!tier) return fail("tier_not_found", "Membership tier not found.");
      if (!input.customerId.trim()) return fail("customer_required", "Membership assignment requires a customer id.");
      const active = await deps.store.getActiveMembership(ctx.tenantId, input.customerId);
      if (active) return fail("active_membership_exists", "Customer already has an active membership.");
      const timestamp = now(ctx);
      const membership: CustomerMembership = {
        id: createId("mcmem"),
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        tierId: tier.id,
        status: "active",
        subscriptionType: input.subscriptionType ?? "manual",
        startedAt: input.startedAt ?? timestamp,
        expiresAt: input.expiresAt ?? null,
        cancelledAt: null,
        autoRenew: input.autoRenew ?? true,
        gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
        externalSubscriptionId: nullableTrim(input.externalSubscriptionId),
        externalCustomerId: nullableTrim(input.externalCustomerId),
        previousTierId: null,
        source: nullableTrim(input.source),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.insertMembership(membership);
      await addHistory(deps.store, ctx, createId, membership.id, "created", null, tier.id, input.reason, { source: input.source ?? null });
      return ok(membership);
    },

    async changeMembershipTier(ctx, input) {
      const membership = await deps.store.getActiveMembership(ctx.tenantId, input.customerId);
      if (!membership) return fail("active_membership_not_found", "Customer has no active membership.");
      const [fromTier, toTier] = await Promise.all([
        deps.store.getTier(ctx.tenantId, membership.tierId),
        deps.store.getTier(ctx.tenantId, input.tierId)
      ]);
      if (!toTier) return fail("tier_not_found", "Membership tier not found.");
      const action: MembershipHistoryAction = (toTier.level ?? 0) >= (fromTier?.level ?? 0) ? "upgraded" : "downgraded";
      const updated = { ...membership, tierId: toTier.id, previousTierId: membership.tierId, updatedAt: now(ctx) };
      await deps.store.updateMembership(updated);
      await addHistory(deps.store, ctx, createId, membership.id, action, membership.tierId, toTier.id, input.reason);
      return ok(updated);
    },

    async cancelMembership(ctx, input) {
      const membership = await deps.store.getActiveMembership(ctx.tenantId, input.customerId);
      if (!membership) return fail("active_membership_not_found", "Customer has no active membership.");
      const timestamp = now(ctx);
      const updated = { ...membership, status: "cancelled" as const, cancelledAt: timestamp, autoRenew: false, updatedAt: timestamp };
      await deps.store.updateMembership(updated);
      await addHistory(deps.store, ctx, createId, membership.id, "cancelled", membership.tierId, membership.tierId, input.reason);
      return ok(updated);
    },

    async expireMemberships(ctx, input) {
      const filter: MembershipListFilter = { status: "active", expiresBefore: input.asOf, limit: input.limit };
      const due = await deps.store.listMemberships(ctx.tenantId, filter);
      const expired: CustomerMembership[] = [];
      for (const membership of due) {
        const updated = { ...membership, status: "expired" as const, updatedAt: now(ctx) };
        await deps.store.updateMembership(updated);
        await addHistory(deps.store, ctx, createId, membership.id, "expired", membership.tierId, membership.tierId, "Membership expiry job", { asOf: input.asOf });
        expired.push(updated);
      }
      return ok(expired);
    },

    async getCustomerMembershipSnapshot(ctx, customerId) {
      if (!customerId.trim()) return fail("customer_required", "Snapshot requires a customer id.");
      const membership = await deps.store.getActiveMembership(ctx.tenantId, customerId);
      const [tier, creditBalance, creditLedger, history] = await Promise.all([
        membership ? deps.store.getTier(ctx.tenantId, membership.tierId) : Promise.resolve(null),
        getOrCreateBalance(ctx, customerId),
        deps.store.listCreditTransactions(ctx.tenantId, { customerId, limit: 10 }),
        membership ? deps.store.listMembershipHistory(ctx.tenantId, membership.id) : Promise.resolve([])
      ]);
      return ok({ membership, tier, creditBalance, recentCreditTransactions: creditLedger.transactions, membershipHistory: history });
    },

    async grantCustomerCredit(ctx, input) {
      return moveCredit(ctx, input, "credit", "admin_grant");
    },

    async debitCustomerCredit(ctx, input) {
      return moveCredit(ctx, input, "debit", "admin_deduct");
    },

    async applyCreditToBooking(ctx, input) {
      return moveCredit(ctx, input, "debit", "booking_payment");
    },

    async refundBookingToCredit(ctx, input) {
      return moveCredit(ctx, input, "credit", "booking_refund");
    },

    async getCustomerCreditLedger(ctx, filter) {
      if (!filter.customerId.trim()) return fail("customer_required", "Credit ledger requires a customer id.");
      return ok(await deps.store.listCreditTransactions(ctx.tenantId, filter));
    }
  };
}

export function getMembershipCreditsModuleStatus() {
  return { id: "membership-credits", status: "draft" } as const;
}
