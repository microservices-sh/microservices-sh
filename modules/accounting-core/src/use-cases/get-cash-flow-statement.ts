import { cashFlowStatementSchema } from "../schemas";
import { previousDate } from "../service";
import type { Account, CashFlowStatement, FinancialStatementLine, GeneralLedgerPosting } from "../types";
import { err, ok, type AccountingDeps } from "./shared";
import { cashPostingAmount, section, validateRange } from "./statement-shared";

type CashFlowKey = "operating" | "investing" | "financing" | "unclassified";

function isCashLike(account: Account, depositAccountIds: Set<string>): boolean {
  return account.type === "asset" && (account.isReconcilable || depositAccountIds.has(account.id));
}

function classify(posting: GeneralLedgerPosting): CashFlowKey {
  const sourceType = (posting.sourceType ?? "").toLowerCase();
  if (
    sourceType.includes("accounts-receivable") ||
    sourceType.includes("accounts-payable") ||
    sourceType.includes("invoice") ||
    sourceType.includes("payment")
  ) {
    return "operating";
  }
  if (sourceType.includes("fixed-asset") || sourceType.includes("asset-disposal") || sourceType.includes("investment")) {
    return "investing";
  }
  if (sourceType.includes("loan") || sourceType.includes("equity") || sourceType.includes("owner")) {
    return "financing";
  }
  return "unclassified";
}

function cashFlowLine(account: Account, posting: GeneralLedgerPosting): FinancialStatementLine {
  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: `${account.name}: ${posting.description ?? posting.lineDescription ?? posting.sourceRef ?? posting.entryId}`,
    accountType: account.type,
    accountSubtype: account.subtype,
    amountCents: cashPostingAmount(account, posting)
  };
}

export async function getCashFlowStatement(input: unknown, deps: AccountingDeps) {
  const parsed = cashFlowStatementSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_CASH_FLOW_INPUT", "Cash flow statement input is invalid.", parsed.error.issues);
  }
  if (!validateRange(parsed.data.startDate, parsed.data.endDate)) {
    return err(400, "accounting-core.INVALID_STATEMENT_RANGE", "Statement start date must be on or before end date.");
  }

  const [settings, accounts] = await Promise.all([
    deps.accountingCoreStore.getAccountingSettings(parsed.data.tenantId),
    deps.accountingCoreStore.listAccounts({ tenantId: parsed.data.tenantId, includeInactive: true, limit: 500 })
  ]);
  const depositAccountIds = new Set(
    [settings?.defaultDepositAccountId, settings?.stripeDepositAccountId].filter((id): id is string => Boolean(id))
  );
  const cashAccounts = accounts.filter((account) => isCashLike(account, depositAccountIds));
  const linesBySection: Record<CashFlowKey, FinancialStatementLine[]> = {
    operating: [],
    investing: [],
    financing: [],
    unclassified: []
  };

  let beginningCashCents = 0;
  for (const account of cashAccounts) {
    const opening = await deps.accountingCoreStore.listGeneralLedgerPostings({
      tenantId: parsed.data.tenantId,
      accountId: account.id,
      endDate: previousDate(parsed.data.startDate)
    });
    beginningCashCents += opening.reduce((sum, posting) => sum + cashPostingAmount(account, posting), 0);

    const postings = await deps.accountingCoreStore.listGeneralLedgerPostings({
      tenantId: parsed.data.tenantId,
      accountId: account.id,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate
    });
    for (const posting of postings) {
      linesBySection[classify(posting)].push(cashFlowLine(account, posting));
    }
  }

  const sections = [
    section("operating", "Operating activities", linesBySection.operating),
    section("investing", "Investing activities", linesBySection.investing),
    section("financing", "Financing activities", linesBySection.financing),
    section("unclassified", "Unclassified cash activity", linesBySection.unclassified)
  ];
  const netCashChangeCents = sections.reduce((sum, item) => sum + item.totalCents, 0);
  const cashFlowStatement: CashFlowStatement = {
    tenantId: parsed.data.tenantId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    cashAccountIds: cashAccounts.map((account) => account.id),
    beginningCashCents,
    endingCashCents: beginningCashCents + netCashChangeCents,
    sections,
    netCashChangeCents
  };

  return ok(200, { cashFlowStatement });
}
