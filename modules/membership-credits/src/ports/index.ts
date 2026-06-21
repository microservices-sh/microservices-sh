import type {
  CreditLedgerFilter,
  CreditSource,
  CreditTransaction,
  CreditTransactionType,
  CustomerCreditBalance,
  CustomerMembership,
  CustomerMembershipStatus,
  MembershipHistoryEntry,
  MembershipTier
} from "../types";

export interface MembershipListFilter {
  customerId?: string;
  status?: CustomerMembershipStatus;
  expiresBefore?: string;
  limit?: number;
}

export interface MembershipCreditsStore {
  getTier(tenantId: string, tierId: string): Promise<MembershipTier | null>;
  getTierBySlug(tenantId: string, slug: string): Promise<MembershipTier | null>;
  upsertTier(tier: MembershipTier): Promise<void>;
  listTiers(tenantId: string): Promise<MembershipTier[]>;

  getMembership(tenantId: string, membershipId: string): Promise<CustomerMembership | null>;
  getActiveMembership(tenantId: string, customerId: string): Promise<CustomerMembership | null>;
  insertMembership(membership: CustomerMembership): Promise<void>;
  updateMembership(membership: CustomerMembership): Promise<void>;
  listMemberships(tenantId: string, filter?: MembershipListFilter): Promise<CustomerMembership[]>;

  getCreditBalance(tenantId: string, customerId: string): Promise<CustomerCreditBalance | null>;
  upsertCreditBalance(balance: CustomerCreditBalance): Promise<void>;
  insertCreditTransaction(transaction: CreditTransaction): Promise<void>;
  findCreditTransactionByReference(
    tenantId: string,
    customerId: string,
    type: CreditTransactionType,
    source: CreditSource,
    referenceType: string | null,
    referenceId: string | null
  ): Promise<CreditTransaction | null>;
  listCreditTransactions(tenantId: string, filter: CreditLedgerFilter): Promise<{ transactions: CreditTransaction[]; total: number }>;

  insertMembershipHistory(entry: MembershipHistoryEntry): Promise<void>;
  listMembershipHistory(tenantId: string, membershipId: string): Promise<MembershipHistoryEntry[]>;
}
