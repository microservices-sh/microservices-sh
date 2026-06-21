import {
  seedChartOfAccountsSchema,
  seedMonthlyFiscalPeriodsSchema,
  setupStatusInputSchema
} from "../schemas";
import type { AccountSubtype, AccountType, ChartOfAccountsStandard, NormalBalance } from "../types";
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

export async function getAccountingSetupStatus(input: unknown, deps: AccountingDeps) {
  const parsed = setupStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_SETUP_STATUS_INPUT", "Accounting setup status input is invalid.", parsed.error.issues);
  }

  const [accounts, periods] = await Promise.all([
    deps.accountingCoreStore.listAccounts({ tenantId: parsed.data.tenantId, includeInactive: true, limit: 5000 }),
    deps.accountingCoreStore.listFiscalPeriods({ tenantId: parsed.data.tenantId, limit: 5000 })
  ]);

  return ok(200, {
    status: {
      tenantId: parsed.data.tenantId,
      accountsConfigured: accounts.length > 0,
      accountCount: accounts.length,
      fiscalPeriodsConfigured: periods.length > 0,
      fiscalPeriodCount: periods.length
    }
  });
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

  return ok(201, { accounts: created, count: created.length, standard: parsed.data.standard });
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

  return ok(201, { periods, count: periods.length, year: parsed.data.year });
}
