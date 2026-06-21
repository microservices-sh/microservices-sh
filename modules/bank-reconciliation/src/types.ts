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
  statementImportId?: string;
  transactionDate: string;
  description: string;
  amountCents: number;
  transactionHash: string;
  matchStatus: BankTransactionMatchStatus;
  ledgerReferenceId?: string;
  reconciled: boolean;
  reconciledAt?: string;
  reconciliationId?: string;
  createdAt: string;
}

export interface StatementImportResult {
  imported: BankTransaction[];
  importedCount: number;
  skippedDuplicateCount: number;
  statementImport?: BankStatementImport;
}

export type BankStatementImportSource = "csv" | "ofx" | "qfx" | "qif" | "api";
export type BankStatementImportStatus = "pending" | "processing" | "completed" | "failed";

export interface BankStatementImportFieldMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface BankStatementImport {
  id: string;
  tenantId: string;
  bankAccountId: string;
  source: BankStatementImportSource;
  fileName?: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  startDate?: string;
  endDate?: string;
  fieldMapping?: BankStatementImportFieldMapping;
  status: BankStatementImportStatus;
  errorMessage?: string;
  importedById?: string;
  importedAt?: string;
  createdAt: string;
}

export type ReconciliationStatus = "in_progress" | "completed" | "abandoned";

export interface ReconciliationSession {
  id: string;
  tenantId: string;
  bankAccountId: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalanceCents?: number;
  statementDate: string;
  statementBalanceCents: number;
  clearedDepositsCents?: number;
  clearedWithdrawalsCents?: number;
  clearedBalanceCents?: number;
  differenceCents?: number;
  transactionsCleared?: number;
  transactionsUnmatched?: number;
  status: ReconciliationStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type BankReconciliationRecord = BankAccount | BankStatementImport | BankTransaction | ReconciliationSession;
