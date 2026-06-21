import { generalLedgerSchema } from "../schemas";
import { previousDate } from "../service";
import type { Account, GeneralLedgerEntry, GeneralLedgerPosting } from "../types";
import { err, ok, type AccountingDeps } from "./shared";

function balanceDelta(account: Account, posting: Pick<GeneralLedgerPosting, "debitCents" | "creditCents">): number {
  const signedDebit = posting.debitCents - posting.creditCents;
  return account.normalBalance === "debit" ? signedDebit : -signedDebit;
}

function entriesWithRunningBalance(
  account: Account,
  postings: GeneralLedgerPosting[],
  openingBalanceCents: number
): GeneralLedgerEntry[] {
  let runningBalanceCents = openingBalanceCents;
  return postings.map((posting) => {
    runningBalanceCents += balanceDelta(account, posting);
    return { ...posting, runningBalanceCents };
  });
}

function totals(postings: GeneralLedgerPosting[]) {
  return postings.reduce(
    (sum, posting) => ({
      debitCents: sum.debitCents + posting.debitCents,
      creditCents: sum.creditCents + posting.creditCents
    }),
    { debitCents: 0, creditCents: 0 }
  );
}

export async function getGeneralLedger(input: unknown, deps: AccountingDeps) {
  const parsed = generalLedgerSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_GENERAL_LEDGER_INPUT", "General ledger input is invalid.", parsed.error.issues);
  }
  if (parsed.data.startDate && parsed.data.endDate && parsed.data.startDate > parsed.data.endDate) {
    return err(400, "accounting-core.INVALID_GENERAL_LEDGER_RANGE", "General ledger start date must be on or before end date.");
  }

  const account = await deps.accountingCoreStore.getAccount(parsed.data.tenantId, parsed.data.accountId);
  if (!account) return err(404, "accounting-core.ACCOUNT_NOT_FOUND", "Account not found.");

  let effectiveStartDate = parsed.data.startDate ?? null;
  if (parsed.data.periodId) {
    const period = await deps.accountingCoreStore.getFiscalPeriod(parsed.data.tenantId, parsed.data.periodId);
    if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");
    effectiveStartDate = effectiveStartDate ?? period.startsOn;
  }

  const openingPostings =
    parsed.data.includeOpeningBalance && effectiveStartDate
      ? await deps.accountingCoreStore.listGeneralLedgerPostings({
          tenantId: parsed.data.tenantId,
          accountId: parsed.data.accountId,
          endDate: previousDate(effectiveStartDate)
        })
      : [];
  const openingBalanceCents = openingPostings.reduce((sum, posting) => sum + balanceDelta(account, posting), 0);

  const postings = await deps.accountingCoreStore.listGeneralLedgerPostings(parsed.data);
  const reportTotals = totals(postings);
  const entries = entriesWithRunningBalance(account, postings, openingBalanceCents);
  const closingBalanceCents =
    entries.length > 0 ? entries[entries.length - 1]!.runningBalanceCents : openingBalanceCents;

  return ok(200, {
    generalLedger: {
      tenantId: parsed.data.tenantId,
      account,
      periodId: parsed.data.periodId ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      openingBalanceCents,
      totalDebitCents: reportTotals.debitCents,
      totalCreditCents: reportTotals.creditCents,
      closingBalanceCents,
      entries
    }
  });
}
