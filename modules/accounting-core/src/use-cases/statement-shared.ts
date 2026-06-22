import type {
  Account,
  AccountSubtype,
  FinancialStatementLine,
  FinancialStatementSection,
  GeneralLedgerPosting,
  TrialBalancePosting
} from "../types";

export function normalBalanceAmount(posting: TrialBalancePosting): number {
  const signedDebitBalance = posting.rawDebitCents - posting.rawCreditCents;
  return posting.account.normalBalance === "debit" ? signedDebitBalance : -signedDebitBalance;
}

export function cashPostingAmount(account: Account, posting: Pick<GeneralLedgerPosting, "debitCents" | "creditCents">): number {
  const signedDebitBalance = posting.debitCents - posting.creditCents;
  return account.normalBalance === "debit" ? signedDebitBalance : -signedDebitBalance;
}

export function lineFromPosting(posting: TrialBalancePosting): FinancialStatementLine {
  return {
    accountId: posting.account.id,
    accountCode: posting.account.code,
    accountName: posting.account.name,
    accountType: posting.account.type,
    accountSubtype: posting.account.subtype,
    amountCents: normalBalanceAmount(posting)
  };
}

export function section(key: string, label: string, lines: FinancialStatementLine[]): FinancialStatementSection {
  const sortedLines = [...lines].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  return {
    key,
    label,
    lines: sortedLines,
    totalCents: sortedLines.reduce((sum, line) => sum + line.amountCents, 0)
  };
}

export function subtypeIn(subtypes: AccountSubtype[]) {
  return (posting: TrialBalancePosting) => posting.account.subtype !== null && subtypes.includes(posting.account.subtype);
}

export function validateRange(startDate: string, endDate: string): boolean {
  return startDate <= endDate;
}
