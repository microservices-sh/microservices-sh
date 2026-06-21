import type { MembershipCreditsStore, MembershipListFilter } from "../ports";
import type { CreditLedgerFilter, CreditSource, CreditTransaction, CreditTransactionType, CustomerCreditBalance, CustomerMembership, MembershipHistoryEntry, MembershipTier } from "../types";

const TIER_COLS =
  "id, tenant_id, name, slug, description, level, discount_basis_points, is_free, is_default, price_monthly_cents, price_yearly_cents, price_lifetime_cents, currency, benefits_json, badge_color, badge_icon, max_advance_booking_days, max_bookings_per_month, priority_booking_hours, status, position, created_at, updated_at";
const MEMBERSHIP_COLS =
  "id, tenant_id, customer_id, tier_id, status, subscription_type, started_at, expires_at, cancelled_at, auto_renew, grace_period_ends_at, external_subscription_id, external_customer_id, previous_tier_id, source, created_at, updated_at";
const BALANCE_COLS = "id, tenant_id, customer_id, balance_cents, total_credited_cents, total_used_cents, currency, created_at, updated_at";
const TX_COLS =
  "id, tenant_id, customer_id, type, amount_cents, balance_before_cents, balance_after_cents, source, reference_type, reference_id, description, performed_by, created_at";
const HISTORY_COLS = "id, tenant_id, membership_id, from_tier_id, to_tier_id, action, reason, performed_by, metadata_json, created_at";

function toBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toTier(row: Record<string, unknown>): MembershipTier {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    level: Number(row.level ?? 0),
    discountBasisPoints: Number(row.discount_basis_points ?? 0),
    isFree: toBool(row.is_free),
    isDefault: toBool(row.is_default),
    priceMonthlyCents: row.price_monthly_cents == null ? null : Number(row.price_monthly_cents),
    priceYearlyCents: row.price_yearly_cents == null ? null : Number(row.price_yearly_cents),
    priceLifetimeCents: row.price_lifetime_cents == null ? null : Number(row.price_lifetime_cents),
    currency: String(row.currency),
    benefits: parseStringArray(row.benefits_json),
    badgeColor: row.badge_color == null ? null : String(row.badge_color),
    badgeIcon: row.badge_icon == null ? null : String(row.badge_icon),
    maxAdvanceBookingDays: row.max_advance_booking_days == null ? null : Number(row.max_advance_booking_days),
    maxBookingsPerMonth: row.max_bookings_per_month == null ? null : Number(row.max_bookings_per_month),
    priorityBookingHours: Number(row.priority_booking_hours ?? 0),
    status: String(row.status) as MembershipTier["status"],
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toMembership(row: Record<string, unknown>): CustomerMembership {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    tierId: String(row.tier_id),
    status: String(row.status) as CustomerMembership["status"],
    subscriptionType: String(row.subscription_type) as CustomerMembership["subscriptionType"],
    startedAt: String(row.started_at),
    expiresAt: row.expires_at == null ? null : String(row.expires_at),
    cancelledAt: row.cancelled_at == null ? null : String(row.cancelled_at),
    autoRenew: toBool(row.auto_renew),
    gracePeriodEndsAt: row.grace_period_ends_at == null ? null : String(row.grace_period_ends_at),
    externalSubscriptionId: row.external_subscription_id == null ? null : String(row.external_subscription_id),
    externalCustomerId: row.external_customer_id == null ? null : String(row.external_customer_id),
    previousTierId: row.previous_tier_id == null ? null : String(row.previous_tier_id),
    source: row.source == null ? null : String(row.source),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toBalance(row: Record<string, unknown>): CustomerCreditBalance {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    balanceCents: Number(row.balance_cents ?? 0),
    totalCreditedCents: Number(row.total_credited_cents ?? 0),
    totalUsedCents: Number(row.total_used_cents ?? 0),
    currency: String(row.currency),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toTransaction(row: Record<string, unknown>): CreditTransaction {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    type: String(row.type) as CreditTransaction["type"],
    amountCents: Number(row.amount_cents ?? 0),
    balanceBeforeCents: Number(row.balance_before_cents ?? 0),
    balanceAfterCents: Number(row.balance_after_cents ?? 0),
    source: String(row.source) as CreditTransaction["source"],
    referenceType: row.reference_type == null ? null : String(row.reference_type),
    referenceId: row.reference_id == null ? null : String(row.reference_id),
    description: String(row.description),
    performedBy: row.performed_by == null ? null : String(row.performed_by),
    createdAt: String(row.created_at)
  };
}

function toHistory(row: Record<string, unknown>): MembershipHistoryEntry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    membershipId: String(row.membership_id),
    fromTierId: row.from_tier_id == null ? null : String(row.from_tier_id),
    toTierId: row.to_tier_id == null ? null : String(row.to_tier_id),
    action: String(row.action) as MembershipHistoryEntry["action"],
    reason: row.reason == null ? null : String(row.reason),
    performedBy: row.performed_by == null ? null : String(row.performed_by),
    metadata: parseRecord(row.metadata_json),
    createdAt: String(row.created_at)
  };
}

export function createD1MembershipCreditsStore(db: D1Database): MembershipCreditsStore {
  return {
    async getTier(tenantId, tierId) {
      const row = await db.prepare(`SELECT ${TIER_COLS} FROM membership_credit_tiers WHERE tenant_id = ? AND id = ?`).bind(tenantId, tierId).first<Record<string, unknown>>();
      return row ? toTier(row) : null;
    },

    async getTierBySlug(tenantId, slug) {
      const row = await db.prepare(`SELECT ${TIER_COLS} FROM membership_credit_tiers WHERE tenant_id = ? AND slug = ?`).bind(tenantId, slug).first<Record<string, unknown>>();
      return row ? toTier(row) : null;
    },

    async upsertTier(tier) {
      if (tier.isDefault) {
        await db.prepare("UPDATE membership_credit_tiers SET is_default = 0, updated_at = ? WHERE tenant_id = ? AND id <> ?").bind(tier.updatedAt, tier.tenantId, tier.id).run();
      }
      await db.prepare(
        `INSERT INTO membership_credit_tiers (${TIER_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, slug) DO UPDATE SET
           name = excluded.name, description = excluded.description, level = excluded.level, discount_basis_points = excluded.discount_basis_points,
           is_free = excluded.is_free, is_default = excluded.is_default, price_monthly_cents = excluded.price_monthly_cents,
           price_yearly_cents = excluded.price_yearly_cents, price_lifetime_cents = excluded.price_lifetime_cents, currency = excluded.currency,
           benefits_json = excluded.benefits_json, badge_color = excluded.badge_color, badge_icon = excluded.badge_icon,
           max_advance_booking_days = excluded.max_advance_booking_days, max_bookings_per_month = excluded.max_bookings_per_month,
           priority_booking_hours = excluded.priority_booking_hours, status = excluded.status, position = excluded.position, updated_at = excluded.updated_at`
      )
        .bind(
          tier.id,
          tier.tenantId,
          tier.name,
          tier.slug,
          tier.description,
          tier.level,
          tier.discountBasisPoints,
          tier.isFree ? 1 : 0,
          tier.isDefault ? 1 : 0,
          tier.priceMonthlyCents,
          tier.priceYearlyCents,
          tier.priceLifetimeCents,
          tier.currency,
          JSON.stringify(tier.benefits),
          tier.badgeColor,
          tier.badgeIcon,
          tier.maxAdvanceBookingDays,
          tier.maxBookingsPerMonth,
          tier.priorityBookingHours,
          tier.status,
          tier.position,
          tier.createdAt,
          tier.updatedAt
        )
        .run();
    },

    async listTiers(tenantId) {
      const result = await db.prepare(`SELECT ${TIER_COLS} FROM membership_credit_tiers WHERE tenant_id = ? ORDER BY position ASC, level ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toTier);
    },

    async getMembership(tenantId, membershipId) {
      const row = await db.prepare(`SELECT ${MEMBERSHIP_COLS} FROM customer_memberships WHERE tenant_id = ? AND id = ?`).bind(tenantId, membershipId).first<Record<string, unknown>>();
      return row ? toMembership(row) : null;
    },

    async getActiveMembership(tenantId, customerId) {
      const row = await db
        .prepare(`SELECT ${MEMBERSHIP_COLS} FROM customer_memberships WHERE tenant_id = ? AND customer_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`)
        .bind(tenantId, customerId)
        .first<Record<string, unknown>>();
      return row ? toMembership(row) : null;
    },

    async insertMembership(membership) {
      await db.prepare(`INSERT INTO customer_memberships (${MEMBERSHIP_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          membership.id,
          membership.tenantId,
          membership.customerId,
          membership.tierId,
          membership.status,
          membership.subscriptionType,
          membership.startedAt,
          membership.expiresAt,
          membership.cancelledAt,
          membership.autoRenew ? 1 : 0,
          membership.gracePeriodEndsAt,
          membership.externalSubscriptionId,
          membership.externalCustomerId,
          membership.previousTierId,
          membership.source,
          membership.createdAt,
          membership.updatedAt
        )
        .run();
    },

    async updateMembership(membership) {
      await db.prepare(
        `UPDATE customer_memberships SET tier_id = ?, status = ?, subscription_type = ?, expires_at = ?, cancelled_at = ?, auto_renew = ?, grace_period_ends_at = ?, external_subscription_id = ?, external_customer_id = ?, previous_tier_id = ?, source = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
        .bind(
          membership.tierId,
          membership.status,
          membership.subscriptionType,
          membership.expiresAt,
          membership.cancelledAt,
          membership.autoRenew ? 1 : 0,
          membership.gracePeriodEndsAt,
          membership.externalSubscriptionId,
          membership.externalCustomerId,
          membership.previousTierId,
          membership.source,
          membership.updatedAt,
          membership.tenantId,
          membership.id
        )
        .run();
    },

    async listMemberships(tenantId, filter?: MembershipListFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [tenantId];
      if (filter?.customerId) {
        clauses.push("customer_id = ?");
        binds.push(filter.customerId);
      }
      if (filter?.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter?.expiresBefore) {
        clauses.push("expires_at IS NOT NULL", "expires_at <= ?");
        binds.push(filter.expiresBefore);
      }
      const result = await db
        .prepare(`SELECT ${MEMBERSHIP_COLS} FROM customer_memberships WHERE ${clauses.join(" AND ")} ORDER BY COALESCE(expires_at, started_at) ASC LIMIT ?`)
        .bind(...binds, filter?.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toMembership);
    },

    async getCreditBalance(tenantId, customerId) {
      const row = await db.prepare(`SELECT ${BALANCE_COLS} FROM customer_credit_balances WHERE tenant_id = ? AND customer_id = ?`).bind(tenantId, customerId).first<Record<string, unknown>>();
      return row ? toBalance(row) : null;
    },

    async upsertCreditBalance(balance) {
      await db.prepare(
        `INSERT INTO customer_credit_balances (${BALANCE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, customer_id) DO UPDATE SET
           balance_cents = excluded.balance_cents, total_credited_cents = excluded.total_credited_cents, total_used_cents = excluded.total_used_cents, currency = excluded.currency, updated_at = excluded.updated_at`
      )
        .bind(
          balance.id,
          balance.tenantId,
          balance.customerId,
          balance.balanceCents,
          balance.totalCreditedCents,
          balance.totalUsedCents,
          balance.currency,
          balance.createdAt,
          balance.updatedAt
        )
        .run();
    },

    async insertCreditTransaction(transaction) {
      await db.prepare(`INSERT INTO credit_transactions (${TX_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          transaction.id,
          transaction.tenantId,
          transaction.customerId,
          transaction.type,
          transaction.amountCents,
          transaction.balanceBeforeCents,
          transaction.balanceAfterCents,
          transaction.source,
          transaction.referenceType,
          transaction.referenceId,
          transaction.description,
          transaction.performedBy,
          transaction.createdAt
        )
        .run();
    },

    async findCreditTransactionByReference(tenantId, customerId, type: CreditTransactionType, source: CreditSource, referenceType, referenceId) {
      const row = await db
        .prepare(
          `SELECT ${TX_COLS} FROM credit_transactions
           WHERE tenant_id = ? AND customer_id = ? AND type = ? AND source = ? AND reference_type IS ? AND reference_id IS ?
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(tenantId, customerId, type, source, referenceType, referenceId)
        .first<Record<string, unknown>>();
      return row ? toTransaction(row) : null;
    },

    async listCreditTransactions(tenantId, filter: CreditLedgerFilter) {
      const clauses = ["tenant_id = ?", "customer_id = ?"];
      const binds: unknown[] = [tenantId, filter.customerId];
      if (filter.type) {
        clauses.push("type = ?");
        binds.push(filter.type);
      }
      if (filter.source) {
        clauses.push("source = ?");
        binds.push(filter.source);
      }
      const where = clauses.join(" AND ");
      const [rows, count] = await Promise.all([
        db.prepare(`SELECT ${TX_COLS} FROM credit_transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, filter.limit ?? 100, filter.offset ?? 0).all<Record<string, unknown>>(),
        db.prepare(`SELECT COUNT(*) AS count FROM credit_transactions WHERE ${where}`).bind(...binds).first<{ count: number }>()
      ]);
      return { transactions: (rows.results ?? []).map(toTransaction), total: Number(count?.count ?? 0) };
    },

    async insertMembershipHistory(entry) {
      await db.prepare(`INSERT INTO membership_history (${HISTORY_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          entry.id,
          entry.tenantId,
          entry.membershipId,
          entry.fromTierId,
          entry.toTierId,
          entry.action,
          entry.reason,
          entry.performedBy,
          JSON.stringify(entry.metadata),
          entry.createdAt
        )
        .run();
    },

    async listMembershipHistory(tenantId, membershipId) {
      const result = await db.prepare(`SELECT ${HISTORY_COLS} FROM membership_history WHERE tenant_id = ? AND membership_id = ? ORDER BY created_at DESC`).bind(tenantId, membershipId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toHistory);
    }
  };
}
