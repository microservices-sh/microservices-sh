export interface BankReconciliationConfig {
  enabled: boolean;
}

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  name: string;
  bankName?: string;
  currency: string;
  openingBalanceCents: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BankTransactionMatchStatus = "unmatched" | "auto_matched" | "manual_matched" | "excluded";

export interface BankTransaction {
  id: string;
  tenantId: string;
  bankAccountId: string;
  transactionDate: string;
  description: string;
  amountCents: number;
  transactionHash: string;
  matchStatus: BankTransactionMatchStatus;
  ledgerReferenceId?: string;
  reconciled: boolean;
  createdAt: string;
}

export interface StatementImportResult {
  imported: BankTransaction[];
  importedCount: number;
  skippedDuplicateCount: number;
}

export type ReconciliationStatus = "in_progress" | "completed";

export interface ReconciliationSession {
  id: string;
  tenantId: string;
  bankAccountId: string;
  statementDate: string;
  statementBalanceCents: number;
  status: ReconciliationStatus;
  completedAt?: string;
  createdAt: string;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type BankReconciliationRecord = BankAccount | BankTransaction | ReconciliationSession;
