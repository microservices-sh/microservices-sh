export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type AccountSubtype =
  | "current_asset"
  | "fixed_asset"
  | "other_asset"
  | "current_liability"
  | "long_term_liability"
  | "owner_equity"
  | "retained_earnings"
  | "operating_revenue"
  | "other_revenue"
  | "operating_expense"
  | "cogs"
  | "other_expense";
export type NormalBalance = "debit" | "credit";
export type FiscalPeriodType = "month" | "quarter" | "year" | "custom";
export type FiscalPeriodStatus = "open" | "closed" | "locked";
export type JournalEntryStatus = "draft" | "posted" | "void";
export type ChartOfAccountsStandard = "gaap" | "ifrs";

export interface AccountingCoreConfig {
  enabled: boolean;
  defaultCurrency: string;
}

export interface Actor {
  id: string;
  email?: string;
  permissions?: string[];
}

export interface Account {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  parentId: string | null;
  currency: string;
  normalBalance: NormalBalance;
  description: string | null;
  isSystem: boolean;
  isReconcilable: boolean;
  isHeader: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalPeriod {
  id: string;
  tenantId: string;
  name: string;
  periodType: FiscalPeriodType;
  startsOn: string;
  endsOn: string;
  status: FiscalPeriodStatus;
  closedById: string | null;
  closedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  periodId: string;
  entryDate: string;
  description: string | null;
  status: JournalEntryStatus;
  sourceRef: string | null;
  sourceType: string | null;
  postedAt: string | null;
  postedById: string | null;
  voidedAt: string | null;
  voidedById: string | null;
  voidReason: string | null;
  reversalEntryId: string | null;
  reversesEntryId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  tenantId: string;
  entryId: string;
  accountId: string;
  description: string | null;
  debitCents: number;
  creditCents: number;
  createdAt: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

export interface AccountFilter {
  tenantId: string;
  includeInactive?: boolean;
  type?: AccountType;
  search?: string;
  limit?: number;
}

export interface FiscalPeriodFilter {
  tenantId: string;
  status?: FiscalPeriodStatus;
  periodType?: FiscalPeriodType;
  limit?: number;
}

export interface TrialBalanceFilter {
  tenantId: string;
  periodId?: string;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  includeZero?: boolean;
}

export interface AccountingSetupStatus {
  tenantId: string;
  accountsConfigured: boolean;
  accountCount: number;
  baseCurrency: string | null;
  settingsConfigured: boolean;
  settings: AccountingSettings | null;
  defaultAccountsConfigured: boolean;
  fiscalPeriodsConfigured: boolean;
  fiscalPeriodCount: number;
}

export interface AccountingSettings {
  tenantId: string;
  accountingStandard: ChartOfAccountsStandard;
  fiscalYearStartMonth: number;
  baseCurrency: string;
  defaultArAccountId: string | null;
  defaultApAccountId: string | null;
  defaultIncomeAccountId: string | null;
  defaultDepositAccountId: string | null;
  stripeDepositAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrialBalancePosting {
  account: Account;
  rawDebitCents: number;
  rawCreditCents: number;
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
}

export interface TrialBalance {
  tenantId: string;
  periodId: string | null;
  asOfDate: string | null;
  lines: TrialBalanceLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  balanced: boolean;
}

export interface FinancialStatementLine {
  accountId: string | null;
  accountCode: string;
  accountName: string;
  accountType: AccountType | "synthetic";
  accountSubtype: AccountSubtype | null;
  amountCents: number;
}

export interface FinancialStatementSection {
  key: string;
  label: string;
  lines: FinancialStatementLine[];
  totalCents: number;
}

export interface IncomeStatementFilter {
  tenantId: string;
  startDate: string;
  endDate: string;
}

export interface IncomeStatement {
  tenantId: string;
  startDate: string;
  endDate: string;
  sections: FinancialStatementSection[];
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

export interface BalanceSheetFilter {
  tenantId: string;
  asOfDate: string;
}

export interface BalanceSheet {
  tenantId: string;
  asOfDate: string;
  sections: FinancialStatementSection[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  balanced: boolean;
}

export interface CashFlowStatementFilter {
  tenantId: string;
  startDate: string;
  endDate: string;
}

export interface CashFlowStatement {
  tenantId: string;
  startDate: string;
  endDate: string;
  cashAccountIds: string[];
  beginningCashCents: number;
  endingCashCents: number;
  sections: FinancialStatementSection[];
  netCashChangeCents: number;
}

export interface GeneralLedgerFilter {
  tenantId: string;
  accountId: string;
  periodId?: string;
  startDate?: string;
  endDate?: string;
  includeOpeningBalance?: boolean;
}

export interface GeneralLedgerPosting {
  entryId: string;
  lineId: string;
  periodId: string;
  entryDate: string;
  description: string | null;
  sourceRef: string | null;
  sourceType: string | null;
  lineDescription: string | null;
  debitCents: number;
  creditCents: number;
}

export interface GeneralLedgerEntry extends GeneralLedgerPosting {
  runningBalanceCents: number;
}

export interface GeneralLedgerReport {
  tenantId: string;
  account: Account;
  periodId: string | null;
  startDate: string | null;
  endDate: string | null;
  openingBalanceCents: number;
  totalDebitCents: number;
  totalCreditCents: number;
  closingBalanceCents: number;
  entries: GeneralLedgerEntry[];
}

export interface AccountingEvent {
  eventName:
    | "accounting-core.account_created"
    | "accounting-core.fiscal_period_created"
    | "accounting-core.fiscal_period_status_changed"
    | "accounting-core.settings_updated"
    | "accounting-core.journal_entry_created"
    | "accounting-core.journal_entry_updated"
    | "accounting-core.journal_entry_posted"
    | "accounting-core.journal_entry_voided";
  entityType: "account" | "accounting_settings" | "fiscal_period" | "journal_entry";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
