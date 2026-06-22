import { balanceSheetSchema } from "../schemas";
import type { BalanceSheet, FinancialStatementLine, TrialBalancePosting } from "../types";
import { err, ok, type AccountingDeps } from "./shared";
import { lineFromPosting, normalBalanceAmount, section } from "./statement-shared";

function byType(type: "asset" | "liability" | "equity" | "revenue" | "expense") {
  return (posting: TrialBalancePosting) => posting.account.type === type;
}

function currentEarningsLine(amountCents: number): FinancialStatementLine | null {
  if (amountCents === 0) return null;
  return {
    accountId: null,
    accountCode: "3999",
    accountName: "Current earnings",
    accountType: "synthetic",
    accountSubtype: "retained_earnings",
    amountCents
  };
}

export async function getBalanceSheet(input: unknown, deps: AccountingDeps) {
  const parsed = balanceSheetSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_BALANCE_SHEET_INPUT", "Balance sheet input is invalid.", parsed.error.issues);
  }

  const postings = await deps.accountingCoreStore.listTrialBalancePostings({
    tenantId: parsed.data.tenantId,
    asOfDate: parsed.data.asOfDate
  });

  const totalRevenueCents = postings.filter(byType("revenue")).reduce((sum, posting) => sum + normalBalanceAmount(posting), 0);
  const totalExpenseCents = postings.filter(byType("expense")).reduce((sum, posting) => sum + normalBalanceAmount(posting), 0);
  const currentEarnings = currentEarningsLine(totalRevenueCents - totalExpenseCents);
  const equityLines = postings.filter(byType("equity")).map(lineFromPosting);
  if (currentEarnings) equityLines.push(currentEarnings);

  const sections = [
    section("assets", "Assets", postings.filter(byType("asset")).map(lineFromPosting)),
    section("liabilities", "Liabilities", postings.filter(byType("liability")).map(lineFromPosting)),
    section("equity", "Equity", equityLines)
  ];
  const totalAssetsCents = sections[0]!.totalCents;
  const totalLiabilitiesCents = sections[1]!.totalCents;
  const totalEquityCents = sections[2]!.totalCents;
  const balanceSheet: BalanceSheet = {
    tenantId: parsed.data.tenantId,
    asOfDate: parsed.data.asOfDate,
    sections,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalEquityCents,
    balanced: totalAssetsCents === totalLiabilitiesCents + totalEquityCents
  };

  return ok(200, { balanceSheet });
}
