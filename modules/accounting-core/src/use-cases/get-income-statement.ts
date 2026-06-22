import { incomeStatementSchema } from "../schemas";
import type { IncomeStatement, TrialBalancePosting } from "../types";
import { err, ok, type AccountingDeps } from "./shared";
import { lineFromPosting, section, subtypeIn, validateRange } from "./statement-shared";

const operatingRevenue = subtypeIn(["operating_revenue"]);
const otherRevenue = subtypeIn(["other_revenue"]);
const cogs = subtypeIn(["cogs"]);
const operatingExpense = subtypeIn(["operating_expense"]);
const otherExpense = subtypeIn(["other_expense"]);

function byType(type: "revenue" | "expense") {
  return (posting: TrialBalancePosting) => posting.account.type === type;
}

export async function getIncomeStatement(input: unknown, deps: AccountingDeps) {
  const parsed = incomeStatementSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_INCOME_STATEMENT_INPUT", "Income statement input is invalid.", parsed.error.issues);
  }
  if (!validateRange(parsed.data.startDate, parsed.data.endDate)) {
    return err(400, "accounting-core.INVALID_STATEMENT_RANGE", "Statement start date must be on or before end date.");
  }

  const postings = await deps.accountingCoreStore.listTrialBalancePostings({
    tenantId: parsed.data.tenantId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate
  });
  const revenuePostings = postings.filter(byType("revenue"));
  const expensePostings = postings.filter(byType("expense"));

  const sections = [
    section("operating_revenue", "Operating revenue", revenuePostings.filter(operatingRevenue).map(lineFromPosting)),
    section(
      "other_revenue",
      "Other revenue",
      revenuePostings.filter((posting) => !operatingRevenue(posting) || otherRevenue(posting)).map(lineFromPosting)
    ),
    section("cost_of_goods_sold", "Cost of goods sold", expensePostings.filter(cogs).map(lineFromPosting)),
    section("operating_expense", "Operating expense", expensePostings.filter(operatingExpense).map(lineFromPosting)),
    section(
      "other_expense",
      "Other expense",
      expensePostings.filter((posting) => !cogs(posting) && !operatingExpense(posting) || otherExpense(posting)).map(lineFromPosting)
    )
  ];

  const totalRevenueCents = sections
    .filter((item) => item.key === "operating_revenue" || item.key === "other_revenue")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const totalExpenseCents = sections
    .filter((item) => item.key === "cost_of_goods_sold" || item.key === "operating_expense" || item.key === "other_expense")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const incomeStatement: IncomeStatement = {
    tenantId: parsed.data.tenantId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    sections,
    totalRevenueCents,
    totalExpenseCents,
    netIncomeCents: totalRevenueCents - totalExpenseCents
  };

  return ok(200, { incomeStatement });
}
