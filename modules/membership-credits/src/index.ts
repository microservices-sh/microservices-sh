export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { membershipCreditsConfigSchema, membershipCreditsRecordSchema } from "./schemas";
export { defaultMembershipCreditsHooks } from "./hooks";
export { events as membershipCreditsEvents } from "./events";
export { permissions as membershipCreditsPermissions } from "./permissions";
export { resources as membershipCreditsResources } from "./resources";
export {
  createMembershipCreditsService,
  createSequentialMembershipCreditsIdFactory,
  getMembershipCreditsModuleStatus
} from "./service";
export { createD1MembershipCreditsStore } from "./adapters/d1";
export { createMembershipCreditsMemoryStore } from "./adapters/memory";
export type { MembershipCreditsHooks } from "./hooks";
export type { MembershipCreditsStore, MembershipListFilter } from "./ports";
export type { MembershipCreditsMemoryStoreState } from "./adapters/memory";
export type { MembershipCreditsService, MembershipCreditsServiceDeps } from "./service";
export type {
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
  CustomerMembershipStatus,
  ExpireMembershipsInput,
  MembershipCreditsConfig,
  MembershipCreditsIdFactory,
  MembershipCreditsIdPrefix,
  MembershipCreditsRecord,
  MembershipHistoryAction,
  MembershipHistoryEntry,
  MembershipSubscriptionType,
  MembershipTier,
  MembershipTierStatus,
  ModuleResult,
  TenantContext
} from "./types";

export const membershipCreditsModule = {
  id: "membership-credits",
  version: "0.1.0"
} as const;
