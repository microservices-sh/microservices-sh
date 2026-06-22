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
export type BankMatchTargetType = "ledger_entry" | "ledger_line" | "payment" | "external_ref";
export type BankMatchType = "auto" | "manual" | "rule";

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

export interface MatchCandidate {
  targetType: BankMatchTargetType;
  targetId: string;
  targetRef?: string | null;
  targetDate?: string | null;
  amountCents: number;
  description?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MatchSuggestion extends MatchCandidate {
  amountDeltaCents: number;
  dateDeltaDays?: number | null;
  confidence: number;
  reasons: string[];
}

export interface CreateMatchInput {
  transactionId: string;
  targetType: BankMatchTargetType;
  targetId: string;
  targetRef?: string | null;
  targetDate?: string | null;
  targetAmountCents: number;
  description?: string | null;
  matchType?: BankMatchType;
  confidence?: number | null;
  reconciliationId?: string | null;
}

export interface CreateMatchResult {
  transaction: BankTransaction;
  match: BankTransactionMatch;
}

export interface UnmatchTransactionInput {
  transactionId: string;
  matchId?: string | null;
}

export interface ExcludeTransactionInput {
  transactionId: string;
  reason?: string | null;
}

export interface RestoreExcludedTransactionInput {
  transactionId: string;
}

export interface BankTransactionCorrectionResult {
  transaction: BankTransaction;
  removedMatchCount?: number;
}

export interface SuggestMatchesInput {
  transactionId: string;
  candidates?: MatchCandidate[];
  dateToleranceDays?: number;
  amountToleranceCents?: number;
  limit?: number;
}

export interface BankTransactionMatch {
  id: string;
  tenantId: string;
  bankTransactionId: string;
  targetType: BankMatchTargetType;
  targetId: string;
  targetRef?: string | null;
  targetDate?: string | null;
  targetAmountCents: number;
  description?: string | null;
  matchType: BankMatchType;
  confidence?: number | null;
  amountMatchedCents: number;
  confirmed: boolean;
  confirmedAt?: string | null;
  confirmedById?: string | null;
  reconciliationId?: string | null;
  createdAt: string;
}

export interface StatementImportResult {
  imported: BankTransaction[];
  importedCount: number;
  skippedDuplicateCount: number;
  statementImport?: BankStatementImport;
}

export type BankStatementImportPreviewRowStatus = "importable" | "duplicate" | "skipped";

export interface BankStatementImportPreviewRow {
  rowNumber: number;
  status: BankStatementImportPreviewRowStatus;
  transactionDate?: string;
  description?: string;
  amountCents?: number;
  transactionHash?: string;
  duplicateTransactionId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface BankStatementImportPreview {
  totalRows: number;
  importableRows: number;
  duplicateRows: number;
  skippedRows: number;
  truncated: boolean;
  previewLimit: number;
  fieldMapping: BankStatementImportFieldMapping;
  rows: BankStatementImportPreviewRow[];
}

export type BankStatementImportSource = "csv" | "ofx" | "qfx" | "qif" | "api";
export type BankStatementImportStatus = "pending" | "processing" | "completed" | "failed";
export type BankStatementImportMappingPresetId = "standard_amount" | "details_debit_credit" | "posted_amount";

export interface BankStatementImportFieldMapping {
  presetId?: BankStatementImportMappingPresetId;
  autoDetected?: boolean;
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface BankStatementImportMappingPreset {
  id: BankStatementImportMappingPresetId;
  label: string;
  description: string;
  fieldMapping: BankStatementImportFieldMapping;
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

export type BankReconciliationRecord =
  | BankAccount
  | BankStatementImport
  | BankTransaction
  | BankTransactionMatch
  | ReconciliationSession;
