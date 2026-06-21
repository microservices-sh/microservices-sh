import type { MembershipCreditsStore, MembershipListFilter } from "../ports";
import type { CreditLedgerFilter, CreditSource, CreditTransaction, CreditTransactionType, CustomerCreditBalance, CustomerMembership, MembershipHistoryEntry, MembershipTier } from "../types";

export interface MembershipCreditsMemoryStoreState {
  tiers?: MembershipTier[];
  memberships?: CustomerMembership[];
  balances?: CustomerCreditBalance[];
  transactions?: CreditTransaction[];
  history?: MembershipHistoryEntry[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

function matchesMembershipFilter(membership: CustomerMembership, filter?: MembershipListFilter): boolean {
  if (filter?.customerId && membership.customerId !== filter.customerId) return false;
  if (filter?.status && membership.status !== filter.status) return false;
  if (filter?.expiresBefore && (!membership.expiresAt || membership.expiresAt > filter.expiresBefore)) return false;
  return true;
}

function matchesLedgerFilter(transaction: CreditTransaction, filter: CreditLedgerFilter): boolean {
  if (transaction.customerId !== filter.customerId) return false;
  if (filter.type && transaction.type !== filter.type) return false;
  if (filter.source && transaction.source !== filter.source) return false;
  return true;
}

export function createMembershipCreditsMemoryStore(initialState: MembershipCreditsMemoryStoreState = {}): MembershipCreditsStore {
  const tiers = new Map<string, MembershipTier>();
  const tierSlugs = new Map<string, string>();
  const memberships = new Map<string, CustomerMembership>();
  const balances = new Map<string, CustomerCreditBalance>();
  const transactions = new Map<string, CreditTransaction>();
  const history = new Map<string, MembershipHistoryEntry>();

  for (const tier of initialState.tiers ?? []) {
    tiers.set(tier.id, copy(tier));
    tierSlugs.set(tenantKey(tier.tenantId, tier.slug), tier.id);
  }
  for (const membership of initialState.memberships ?? []) memberships.set(membership.id, copy(membership));
  for (const balance of initialState.balances ?? []) balances.set(tenantKey(balance.tenantId, balance.customerId), copy(balance));
  for (const transaction of initialState.transactions ?? []) transactions.set(transaction.id, copy(transaction));
  for (const entry of initialState.history ?? []) history.set(entry.id, copy(entry));

  return {
    async getTier(tenantId, tierId) {
      const tier = tiers.get(tierId);
      return tier?.tenantId === tenantId ? copy(tier) : null;
    },

    async getTierBySlug(tenantId, slug) {
      const tierId = tierSlugs.get(tenantKey(tenantId, slug));
      const tier = tierId ? tiers.get(tierId) : null;
      return tier ? copy(tier) : null;
    },

    async upsertTier(tier) {
      if (tier.isDefault) {
        for (const existing of tiers.values()) {
          if (existing.tenantId === tier.tenantId && existing.id !== tier.id && existing.isDefault) {
            tiers.set(existing.id, { ...existing, isDefault: false, updatedAt: tier.updatedAt });
          }
        }
      }
      tiers.set(tier.id, copy(tier));
      tierSlugs.set(tenantKey(tier.tenantId, tier.slug), tier.id);
    },

    async listTiers(tenantId) {
      return [...tiers.values()]
        .filter((tier) => tier.tenantId === tenantId)
        .sort((a, b) => a.position - b.position || a.level - b.level)
        .map(copy);
    },

    async getMembership(tenantId, membershipId) {
      const membership = memberships.get(membershipId);
      return membership?.tenantId === tenantId ? copy(membership) : null;
    },

    async getActiveMembership(tenantId, customerId) {
      const membership = [...memberships.values()]
        .filter((row) => row.tenantId === tenantId && row.customerId === customerId && row.status === "active")
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      return membership ? copy(membership) : null;
    },

    async insertMembership(membership) {
      memberships.set(membership.id, copy(membership));
    },

    async updateMembership(membership) {
      memberships.set(membership.id, copy(membership));
    },

    async listMemberships(tenantId, filter) {
      const rows = [...memberships.values()]
        .filter((membership) => membership.tenantId === tenantId && matchesMembershipFilter(membership, filter))
        .sort((a, b) => (a.expiresAt ?? a.startedAt).localeCompare(b.expiresAt ?? b.startedAt));
      return rows.slice(0, filter?.limit ?? rows.length).map(copy);
    },

    async getCreditBalance(tenantId, customerId) {
      const balance = balances.get(tenantKey(tenantId, customerId));
      return balance ? copy(balance) : null;
    },

    async upsertCreditBalance(balance) {
      balances.set(tenantKey(balance.tenantId, balance.customerId), copy(balance));
    },

    async insertCreditTransaction(transaction) {
      transactions.set(transaction.id, copy(transaction));
    },

    async findCreditTransactionByReference(tenantId, customerId, type: CreditTransactionType, source: CreditSource, referenceType, referenceId) {
      const transaction = [...transactions.values()].find(
        (row) =>
          row.tenantId === tenantId &&
          row.customerId === customerId &&
          row.type === type &&
          row.source === source &&
          row.referenceType === referenceType &&
          row.referenceId === referenceId
      );
      return transaction ? copy(transaction) : null;
    },

    async listCreditTransactions(tenantId, filter) {
      const rows = [...transactions.values()]
        .filter((transaction) => transaction.tenantId === tenantId && matchesLedgerFilter(transaction, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? rows.length;
      return { transactions: rows.slice(offset, offset + limit).map(copy), total: rows.length };
    },

    async insertMembershipHistory(entry) {
      history.set(entry.id, copy(entry));
    },

    async listMembershipHistory(tenantId, membershipId) {
      return [...history.values()]
        .filter((entry) => entry.tenantId === tenantId && entry.membershipId === membershipId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(copy);
    }
  };
}
