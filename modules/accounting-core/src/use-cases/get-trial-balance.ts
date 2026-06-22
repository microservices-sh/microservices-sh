import { trialBalanceSchema } from "../schemas";
import type { Account, TrialBalanceLine, TrialBalancePosting } from "../types";
import { err, ok, type AccountingDeps } from "./shared";

function lineFromPosting(posting: TrialBalancePosting): TrialBalanceLine {
  const signedDebitBalance = posting.rawDebitCents - posting.rawCreditCents;
  const balanceCents =
    signedDebitBalance === 0
      ? 0
      : posting.account.normalBalance === "debit"
        ? signedDebitBalance
        : -signedDebitBalance;
  return {
    accountId: posting.account.id,
    accountCode: posting.account.code,
    accountName: posting.account.name,
    accountType: posting.account.type,
    normalBalance: posting.account.normalBalance,
    debitCents: Math.max(signedDebitBalance, 0),
    creditCents: Math.max(-signedDebitBalance, 0),
    balanceCents
  };
}

function zeroPosting(account: Account): TrialBalancePosting {
  return { account, rawDebitCents: 0, rawCreditCents: 0 };
}

export async function getTrialBalance(input: unknown, deps: AccountingDeps) {
  const parsed = trialBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_TRIAL_BALANCE_INPUT", "Trial balance input is invalid.", parsed.error.issues);
  }
  if (parsed.data.startDate && parsed.data.endDate && parsed.data.startDate > parsed.data.endDate) {
    return err(400, "accounting-core.INVALID_TRIAL_BALANCE_RANGE", "Trial balance start date must be on or before end date.");
  }

  if (parsed.data.periodId) {
    const period = await deps.accountingCoreStore.getFiscalPeriod(parsed.data.tenantId, parsed.data.periodId);
    if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");
  }

  const postings = await deps.accountingCoreStore.listTrialBalancePostings(parsed.data);
  const postingsByAccountId = new Map(postings.map((posting) => [posting.account.id, posting]));

  if (parsed.data.includeZero) {
    const accounts = await deps.accountingCoreStore.listAccounts({
      tenantId: parsed.data.tenantId,
      includeInactive: true,
      limit: 500
    });
    for (const account of accounts) {
      if (!postingsByAccountId.has(account.id)) postingsByAccountId.set(account.id, zeroPosting(account));
    }
  }

  const lines = [...postingsByAccountId.values()]
    .map(lineFromPosting)
    .filter((line) => parsed.data.includeZero || line.debitCents !== 0 || line.creditCents !== 0)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totals = lines.reduce(
    (sum, line) => ({
      debitCents: sum.debitCents + line.debitCents,
      creditCents: sum.creditCents + line.creditCents
    }),
    { debitCents: 0, creditCents: 0 }
  );

  return ok(200, {
    trialBalance: {
      tenantId: parsed.data.tenantId,
      periodId: parsed.data.periodId ?? null,
      asOfDate: parsed.data.asOfDate ?? null,
      lines,
      totalDebitCents: totals.debitCents,
      totalCreditCents: totals.creditCents,
      balanced: totals.debitCents === totals.creditCents
    }
  });
}
