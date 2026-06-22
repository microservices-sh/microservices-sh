import {
  accountingSettingsSchema,
  seedChartOfAccountsSchema,
  seedMonthlyFiscalPeriodsSchema,
  setupStatusInputSchema
} from "../schemas";
import { isoNow } from "../service";
import type {
  AccountingSettings,
  AccountSubtype,
  AccountType,
  ChartOfAccountsStandard,
  NormalBalance
} from "../types";
import { createAccount } from "./create-account";
import { createFiscalPeriod } from "./create-fiscal-period";
import { err, ok, type AccountingDeps } from "./shared";

type AccountTemplate = {
  code: string;
  name: string;
  type: AccountType;
  subtype?: AccountSubtype;
  parentCode?: string;
  normalBalance?: NormalBalance;
  isSystem?: boolean;
  isReconcilable?: boolean;
  isHeader?: boolean;
  description?: string;
};

const GAAP_CHART: AccountTemplate[] = [
  { code: "1000", name: "Assets", type: "asset", isHeader: true },
  { code: "1100", name: "Current Assets", type: "asset", subtype: "current_asset", parentCode: "1000", isHeader: true },
  { code: "1110", name: "Cash and Cash Equivalents", type: "asset", subtype: "current_asset", parentCode: "1100", isHeader: true },
  {
    code: "1111",
    name: "Checking Account",
    type: "asset",
    subtype: "current_asset",
    parentCode: "1110",
    isReconcilable: true,
    description: "Primary operating bank account"
  },
  {
    code: "1112",
    name: "Savings Account",
    type: "asset",
    subtype: "current_asset",
    parentCode: "1110",
    isReconcilable: true,
    description: "Reserve bank account"
  },
  {
    code: "1120",
    name: "Undeposited Funds",
    type: "asset",
    subtype: "current_asset",
    parentCode: "1100",
    isSystem: true,
    description: "Payments received but not yet deposited"
  },
  {
    code: "1200",
    name: "Accounts Receivable",
    type: "asset",
    subtype: "current_asset",
    parentCode: "1100",
    isSystem: true,
    description: "Money owed by customers"
  },
  {
    code: "1250",
    name: "Allowance for Doubtful Accounts",
    type: "asset",
    subtype: "current_asset",
    parentCode: "1100",
    normalBalance: "credit"
  },
  { code: "1500", name: "Fixed Assets", type: "asset", subtype: "fixed_asset", parentCode: "1000", isHeader: true },
  { code: "1510", name: "Furniture and Equipment", type: "asset", subtype: "fixed_asset", parentCode: "1500" },
  {
    code: "1590",
    name: "Accumulated Depreciation",
    type: "asset",
    subtype: "fixed_asset",
    parentCode: "1500",
    normalBalance: "credit",
    isSystem: true
  },
  { code: "2000", name: "Liabilities", type: "liability", isHeader: true },
  { code: "2100", name: "Current Liabilities", type: "liability", subtype: "current_liability", parentCode: "2000", isHeader: true },
  {
    code: "2110",
    name: "Accounts Payable",
    type: "liability",
    subtype: "current_liability",
    parentCode: "2100",
    isSystem: true,
    description: "Money owed to vendors"
  },
  {
    code: "2120",
    name: "Credit Cards Payable",
    type: "liability",
    subtype: "current_liability",
    parentCode: "2100",
    isReconcilable: true
  },
  { code: "3000", name: "Equity", type: "equity", isHeader: true },
  { code: "3100", name: "Owner Equity", type: "equity", subtype: "owner_equity", parentCode: "3000" },
  { code: "3200", name: "Retained Earnings", type: "equity", subtype: "retained_earnings", parentCode: "3000", isSystem: true },
  { code: "4000", name: "Revenue", type: "revenue", subtype: "operating_revenue", isHeader: true },
  { code: "4100", name: "Sales Revenue", type: "revenue", subtype: "operating_revenue", parentCode: "4000", isSystem: true },
  { code: "4200", name: "Service Revenue", type: "revenue", subtype: "operating_revenue", parentCode: "4000" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense", subtype: "cogs", isHeader: true },
  { code: "5100", name: "Product Costs", type: "expense", subtype: "cogs", parentCode: "5000", isSystem: true },
  { code: "6000", name: "Operating Expenses", type: "expense", subtype: "operating_expense", isHeader: true },
  { code: "6100", name: "Rent Expense", type: "expense", subtype: "operating_expense", parentCode: "6000" },
  { code: "6200", name: "Software and Subscriptions", type: "expense", subtype: "operating_expense", parentCode: "6000" },
  { code: "6300", name: "Professional Services", type: "expense", subtype: "operating_expense", parentCode: "6000" },
  { code: "6900", name: "Miscellaneous Expense", type: "expense", subtype: "other_expense", parentCode: "6000" }
];

const IFRS_CHART: AccountTemplate[] = GAAP_CHART.map((account) => ({
  ...account,
  name:
    account.code === "1500"
      ? "Non-Current Assets"
      : account.code === "1510"
        ? "Property, Plant and Equipment"
        : account.name,
  description:
    account.code === "1500"
      ? "IFRS non-current asset grouping"
      : account.code === "1510"
        ? "IFRS property, plant, and equipment account"
        : account.description
}));

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function chartForStandard(standard: ChartOfAccountsStandard): AccountTemplate[] {
  switch (standard) {
    case "gaap":
      return GAAP_CHART;
    case "ifrs":
      return IFRS_CHART;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function setupBaseCurrency(accounts: { currency: string }[]): string | null {
  const currencies = [...new Set(accounts.map((account) => account.currency).filter(Boolean))].sort();
  return currencies.length === 1 ? currencies[0] : null;
}

type DefaultAccountKey =
  | "defaultArAccountId"
  | "defaultApAccountId"
  | "defaultIncomeAccountId"
  | "defaultDepositAccountId"
  | "stripeDepositAccountId";

const DEFAULT_ACCOUNT_CODES: Record<DefaultAccountKey, string> = {
  defaultArAccountId: "1200",
  defaultApAccountId: "2110",
  defaultIncomeAccountId: "4100",
  defaultDepositAccountId: "1120",
  stripeDepositAccountId: "1120"
};

const DEFAULT_ACCOUNT_TYPES: Record<DefaultAccountKey, AccountType> = {
  defaultArAccountId: "asset",
  defaultApAccountId: "liability",
  defaultIncomeAccountId: "revenue",
  defaultDepositAccountId: "asset",
  stripeDepositAccountId: "asset"
};

function cleanCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function defaultAccountsConfigured(settings: AccountingSettings | null): boolean {
  return Boolean(
    settings?.defaultArAccountId &&
      settings.defaultApAccountId &&
      settings.defaultIncomeAccountId &&
      settings.defaultDepositAccountId
  );
}

function hasOwn(data: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function baseSettings(input: {
  tenantId: string;
  nowIso: string;
  existing?: AccountingSettings | null;
  accountingStandard?: ChartOfAccountsStandard;
  fiscalYearStartMonth?: number;
  baseCurrency?: string;
}): AccountingSettings {
  return {
    tenantId: input.tenantId,
    accountingStandard: input.accountingStandard ?? input.existing?.accountingStandard ?? "gaap",
    fiscalYearStartMonth: input.fiscalYearStartMonth ?? input.existing?.fiscalYearStartMonth ?? 1,
    baseCurrency: cleanCurrency(input.baseCurrency ?? input.existing?.baseCurrency ?? "USD"),
    defaultArAccountId: input.existing?.defaultArAccountId ?? null,
    defaultApAccountId: input.existing?.defaultApAccountId ?? null,
    defaultIncomeAccountId: input.existing?.defaultIncomeAccountId ?? null,
    defaultDepositAccountId: input.existing?.defaultDepositAccountId ?? null,
    stripeDepositAccountId: input.existing?.stripeDepositAccountId ?? null,
    createdAt: input.existing?.createdAt ?? input.nowIso,
    updatedAt: input.nowIso
  };
}

async function validateDefaultAccount(
  deps: AccountingDeps,
  tenantId: string,
  key: DefaultAccountKey,
  accountId: string
) {
  const account = await deps.accountingCoreStore.getAccount(tenantId, accountId);
  if (!account) return err(404, "accounting-core.DEFAULT_ACCOUNT_NOT_FOUND", "Default account was not found.");
  if (!account.active) return err(409, "accounting-core.DEFAULT_ACCOUNT_INACTIVE", "Default account must be active.");
  if (account.isHeader) return err(409, "accounting-core.DEFAULT_ACCOUNT_IS_HEADER", "Default account must be postable.");
  if (account.type !== DEFAULT_ACCOUNT_TYPES[key]) {
    return err(409, "accounting-core.DEFAULT_ACCOUNT_TYPE_MISMATCH", "Default account has the wrong account type.", {
      field: key,
      expectedType: DEFAULT_ACCOUNT_TYPES[key],
      actualType: account.type
    });
  }
  return null;
}

async function validateDefaultAccounts(deps: AccountingDeps, settings: AccountingSettings) {
  for (const key of Object.keys(DEFAULT_ACCOUNT_CODES) as DefaultAccountKey[]) {
    const accountId = settings[key];
    if (!accountId) continue;
    const invalid = await validateDefaultAccount(deps, settings.tenantId, key, accountId);
    if (invalid) return invalid;
  }
  return null;
}

function seededDefaultSettings(
  tenantId: string,
  standard: ChartOfAccountsStandard,
  currency: string,
  accountIdsByCode: Map<string, string>,
  existing: AccountingSettings | null,
  nowIso: string
): AccountingSettings {
  const settings = baseSettings({
    tenantId,
    existing,
    nowIso,
    accountingStandard: standard,
    baseCurrency: currency
  });
  settings.defaultArAccountId = accountIdsByCode.get(DEFAULT_ACCOUNT_CODES.defaultArAccountId) ?? settings.defaultArAccountId;
  settings.defaultApAccountId = accountIdsByCode.get(DEFAULT_ACCOUNT_CODES.defaultApAccountId) ?? settings.defaultApAccountId;
  settings.defaultIncomeAccountId =
    accountIdsByCode.get(DEFAULT_ACCOUNT_CODES.defaultIncomeAccountId) ?? settings.defaultIncomeAccountId;
  settings.defaultDepositAccountId =
    accountIdsByCode.get(DEFAULT_ACCOUNT_CODES.defaultDepositAccountId) ?? settings.defaultDepositAccountId;
  return settings;
}

export async function getAccountingSetupStatus(input: unknown, deps: AccountingDeps) {
  const parsed = setupStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_SETUP_STATUS_INPUT", "Accounting setup status input is invalid.", parsed.error.issues);
  }

  const [settings, accounts, periods] = await Promise.all([
    deps.accountingCoreStore.getAccountingSettings(parsed.data.tenantId),
    deps.accountingCoreStore.listAccounts({ tenantId: parsed.data.tenantId, includeInactive: true, limit: 5000 }),
    deps.accountingCoreStore.listFiscalPeriods({ tenantId: parsed.data.tenantId, limit: 5000 })
  ]);

  return ok(200, {
    status: {
      tenantId: parsed.data.tenantId,
      accountsConfigured: accounts.length > 0,
      accountCount: accounts.length,
      baseCurrency: settings?.baseCurrency ?? setupBaseCurrency(accounts),
      settingsConfigured: Boolean(settings),
      settings,
      defaultAccountsConfigured: defaultAccountsConfigured(settings),
      fiscalPeriodsConfigured: periods.length > 0,
      fiscalPeriodCount: periods.length
    }
  });
}

export async function updateAccountingSettings(input: unknown, deps: AccountingDeps) {
  const parsed = accountingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_ACCOUNTING_SETTINGS_INPUT", "Accounting settings input is invalid.", parsed.error.issues);
  }

  const existing = await deps.accountingCoreStore.getAccountingSettings(parsed.data.tenantId);
  const nowIso = isoNow(deps.now);
  const settings = baseSettings({
    tenantId: parsed.data.tenantId,
    existing,
    nowIso,
    accountingStandard: parsed.data.accountingStandard,
    fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
    baseCurrency: parsed.data.baseCurrency
  });

  for (const key of Object.keys(DEFAULT_ACCOUNT_CODES) as DefaultAccountKey[]) {
    if (hasOwn(parsed.data, key)) settings[key] = parsed.data[key] ?? null;
  }

  const invalidDefault = await validateDefaultAccounts(deps, settings);
  if (invalidDefault) return invalidDefault;

  await deps.accountingCoreStore.upsertAccountingSettings(settings);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.settings_updated",
    entityType: "accounting_settings",
    entityId: parsed.data.tenantId,
    tenantId: parsed.data.tenantId,
    payload: {
      accountingStandard: settings.accountingStandard,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      baseCurrency: settings.baseCurrency,
      defaultAccountsConfigured: defaultAccountsConfigured(settings)
    }
  });

  return ok(200, { settings });
}

export async function seedChartOfAccounts(input: unknown, deps: AccountingDeps) {
  const parsed = seedChartOfAccountsSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_CHART_SETUP_INPUT", "Chart-of-accounts setup input is invalid.", parsed.error.issues);
  }

  const existing = await deps.accountingCoreStore.listAccounts({
    tenantId: parsed.data.tenantId,
    includeInactive: true,
    limit: 1
  });
  if (existing.length > 0) {
    return err(409, "accounting-core.CHART_ALREADY_CONFIGURED", "Chart of accounts already exists for this tenant.");
  }

  const created = [];
  const accountIdsByCode = new Map<string, string>();
  for (const account of chartForStandard(parsed.data.standard)) {
    const createdAccount = await createAccount(
      {
        tenantId: parsed.data.tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype ?? null,
        parentId: account.parentCode ? accountIdsByCode.get(account.parentCode) ?? null : null,
        currency: parsed.data.currency,
        normalBalance: account.normalBalance,
        description: account.description ?? null,
        isSystem: account.isSystem ?? false,
        isReconcilable: account.isReconcilable ?? false,
        isHeader: account.isHeader ?? false,
        active: true
      },
      deps
    );
    if (!createdAccount.ok) return createdAccount;
    created.push(createdAccount.data.account);
    accountIdsByCode.set(createdAccount.data.account.code, createdAccount.data.account.id);
  }

  const nowIso = isoNow(deps.now);
  const existingSettings = await deps.accountingCoreStore.getAccountingSettings(parsed.data.tenantId);
  const settings = seededDefaultSettings(
    parsed.data.tenantId,
    parsed.data.standard,
    parsed.data.currency,
    accountIdsByCode,
    existingSettings,
    nowIso
  );
  const invalidDefault = await validateDefaultAccounts(deps, settings);
  if (invalidDefault) return invalidDefault;
  await deps.accountingCoreStore.upsertAccountingSettings(settings);

  return ok(201, { accounts: created, count: created.length, standard: parsed.data.standard, settings });
}

export async function seedMonthlyFiscalPeriods(input: unknown, deps: AccountingDeps) {
  const parsed = seedMonthlyFiscalPeriodsSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_PERIOD_SETUP_INPUT", "Fiscal-period setup input is invalid.", parsed.error.issues);
  }

  const existing = await deps.accountingCoreStore.listFiscalPeriods({
    tenantId: parsed.data.tenantId,
    limit: 1
  });
  if (existing.length > 0) {
    return err(409, "accounting-core.FISCAL_PERIODS_ALREADY_CONFIGURED", "Fiscal periods already exist for this tenant.");
  }

  const periods = [];
  for (let index = 0; index < 12; index += 1) {
    const month = ((parsed.data.fiscalYearStartMonth - 1 + index) % 12) + 1;
    const year =
      parsed.data.fiscalYearStartMonth > 1 && month < parsed.data.fiscalYearStartMonth
        ? parsed.data.year + 1
        : parsed.data.year;
    const created = await createFiscalPeriod(
      {
        tenantId: parsed.data.tenantId,
        name: `${MONTH_NAMES[month - 1]} ${year}`,
        startsOn: dateString(year, month, 1),
        endsOn: dateString(year, month, lastDayOfMonth(year, month)),
        status: "open"
      },
      deps
    );
    if (!created.ok) return created;
    periods.push(created.data.period);
  }

  const nowIso = isoNow(deps.now);
  const existingSettings = await deps.accountingCoreStore.getAccountingSettings(parsed.data.tenantId);
  await deps.accountingCoreStore.upsertAccountingSettings(
    baseSettings({
      tenantId: parsed.data.tenantId,
      existing: existingSettings,
      nowIso,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth
    })
  );

  return ok(201, { periods, count: periods.length, year: parsed.data.year });
}
