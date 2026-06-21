export interface MembershipCreditsConfig {
  enabled: boolean;
  defaultCurrency?: string;
}

export type MembershipCreditsIdPrefix = "mctier" | "mcmem" | "mcbal" | "mctx" | "mchist";
export type MembershipCreditsIdFactory = (prefix: MembershipCreditsIdPrefix) => string;
export type MembershipTierStatus = "active" | "inactive" | "archived";
export type CustomerMembershipStatus = "active" | "expired" | "cancelled" | "suspended";
export type MembershipSubscriptionType = "manual" | "monthly" | "yearly" | "lifetime";
export type MembershipHistoryAction = "created" | "upgraded" | "downgraded" | "renewed" | "cancelled" | "expired" | "suspended" | "reactivated";
export type CreditTransactionType = "credit" | "debit";
export type CreditSource =
  | "admin_grant"
  | "admin_deduct"
  | "booking_refund"
  | "booking_payment"
  | "payment"
  | "adjustment";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface MembershipTier {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  discountBasisPoints: number;
  isFree: boolean;
  isDefault: boolean;
  priceMonthlyCents: number | null;
  priceYearlyCents: number | null;
  priceLifetimeCents: number | null;
  currency: string;
  benefits: string[];
  badgeColor: string | null;
  badgeIcon: string | null;
  maxAdvanceBookingDays: number | null;
  maxBookingsPerMonth: number | null;
  priorityBookingHours: number;
  status: MembershipTierStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMembership {
  id: string;
  tenantId: string;
  customerId: string;
  tierId: string;
  status: CustomerMembershipStatus;
  subscriptionType: MembershipSubscriptionType;
  startedAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  autoRenew: boolean;
  gracePeriodEndsAt: string | null;
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;
  previousTierId: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCreditBalance {
  id: string;
  tenantId: string;
  customerId: string;
  balanceCents: number;
  totalCreditedCents: number;
  totalUsedCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  tenantId: string;
  customerId: string;
  type: CreditTransactionType;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  source: CreditSource;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  performedBy: string | null;
  createdAt: string;
}

export interface MembershipHistoryEntry {
  id: string;
  tenantId: string;
  membershipId: string;
  fromTierId: string | null;
  toTierId: string | null;
  action: MembershipHistoryAction;
  reason: string | null;
  performedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerMembershipSnapshot {
  membership: CustomerMembership | null;
  tier: MembershipTier | null;
  creditBalance: CustomerCreditBalance;
  recentCreditTransactions: CreditTransaction[];
  membershipHistory: MembershipHistoryEntry[];
}

export interface CreateMembershipTierInput {
  name: string;
  slug: string;
  description?: string | null;
  level?: number;
  discountBasisPoints?: number;
  isFree?: boolean;
  isDefault?: boolean;
  priceMonthlyCents?: number | null;
  priceYearlyCents?: number | null;
  priceLifetimeCents?: number | null;
  currency?: string;
  benefits?: string[];
  badgeColor?: string | null;
  badgeIcon?: string | null;
  maxAdvanceBookingDays?: number | null;
  maxBookingsPerMonth?: number | null;
  priorityBookingHours?: number;
  status?: MembershipTierStatus;
  position?: number;
}

export interface AssignMembershipInput {
  customerId: string;
  tierId: string;
  subscriptionType?: MembershipSubscriptionType;
  startedAt?: string;
  expiresAt?: string | null;
  autoRenew?: boolean;
  gracePeriodEndsAt?: string | null;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
  source?: string | null;
  reason?: string | null;
}

export interface ChangeMembershipTierInput {
  customerId: string;
  tierId: string;
  reason?: string | null;
}

export interface CancelMembershipInput {
  customerId: string;
  reason?: string | null;
}

export interface ExpireMembershipsInput {
  asOf: string;
  limit?: number;
}

export interface CreditOperationInput {
  customerId: string;
  amountCents: number;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface CreditLedgerFilter {
  customerId: string;
  type?: CreditTransactionType;
  source?: CreditSource;
  limit?: number;
  offset?: number;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type MembershipCreditsRecord =
  | MembershipTier
  | CustomerMembership
  | CustomerCreditBalance
  | CreditTransaction
  | MembershipHistoryEntry;
