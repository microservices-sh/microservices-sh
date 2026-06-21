import { defaultAccountingCoreHooks, type AccountingCoreHooks } from "../hooks";
import type { AccountingCoreStore } from "../ports";
import { dateInPeriod } from "../service";
import type {
  Account,
  JournalEntry,
  JournalEntryWithLines,
  JournalLine,
  ModuleResult
} from "../types";

export interface AccountingDeps {
  accountingCoreStore: AccountingCoreStore;
  hooks?: AccountingCoreHooks;
  now?: () => number;
}

export function err<T = never>(status: number, code: string, message: string, issues?: unknown): ModuleResult<T> {
  return { ok: false, status, error: { code, message, issues } };
}

export function ok<T>(status: number, data: T): ModuleResult<T> {
  return { ok: true, status, data };
}

export function hooks(deps: AccountingDeps): Required<AccountingCoreHooks> {
  return { ...defaultAccountingCoreHooks, ...(deps.hooks ?? {}) };
}

export async function getEntryWithLines(
  store: AccountingCoreStore,
  tenantId: string,
  entryId: string
): Promise<JournalEntryWithLines | null> {
  const entry = await store.getJournalEntry(tenantId, entryId);
  if (!entry) return null;
  const lines = await store.listJournalLines(tenantId, entry.id);
  return { ...entry, lines };
}

export function balanceTotals(lines: Pick<JournalLine, "debitCents" | "creditCents">[]) {
  return lines.reduce(
    (totals, line) => ({
      debitCents: totals.debitCents + line.debitCents,
      creditCents: totals.creditCents + line.creditCents
    }),
    { debitCents: 0, creditCents: 0 }
  );
}

export function validateBalancedLines(lines: Pick<JournalLine, "debitCents" | "creditCents">[]): ModuleResult<never> | null {
  for (const line of lines) {
    const hasDebit = line.debitCents > 0;
    const hasCredit = line.creditCents > 0;
    if (hasDebit === hasCredit) {
      return err(
        400,
        "accounting-core.INVALID_JOURNAL_LINE",
        "Each journal line must have exactly one non-zero debit or credit amount."
      );
    }
  }

  const totals = balanceTotals(lines);
  if (totals.debitCents !== totals.creditCents) {
    return err(409, "accounting-core.JOURNAL_NOT_BALANCED", "Journal entry debits and credits must balance.", totals);
  }

  return null;
}

export async function resolveLineAccounts(
  store: AccountingCoreStore,
  tenantId: string,
  lines: Pick<JournalLine, "accountId">[]
): Promise<ModuleResult<{ accounts: Account[] }> | null> {
  const accounts: Account[] = [];
  const seen = new Map<string, Account>();

  for (const line of lines) {
    let account = seen.get(line.accountId);
    if (!account) {
      const found = await store.getAccount(tenantId, line.accountId);
      if (!found) {
        return err(404, "accounting-core.ACCOUNT_NOT_FOUND", `Account not found: ${line.accountId}`);
      }
      if (!found.active) {
        return err(409, "accounting-core.INACTIVE_ACCOUNT", `Account is inactive: ${found.code}`);
      }
      if (found.isHeader) {
        return err(409, "accounting-core.HEADER_ACCOUNT_NOT_POSTABLE", `Header account is not postable: ${found.code}`);
      }
      account = found;
      seen.set(account.id, account);
    }
    accounts.push(account);
  }

  return ok(200, { accounts });
}

export async function validateEntryPeriod(
  store: AccountingCoreStore,
  tenantId: string,
  periodId: string,
  entryDate: string,
  requireOpen: boolean
) {
  const period = await store.getFiscalPeriod(tenantId, periodId);
  if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");
  if (!dateInPeriod(entryDate, period)) {
    return err(409, "accounting-core.ENTRY_DATE_OUTSIDE_PERIOD", "Journal entry date must fall inside its fiscal period.");
  }
  if (requireOpen && period.status !== "open") {
    return err(409, "accounting-core.FISCAL_PERIOD_CLOSED", "Closed or locked fiscal periods reject posting.");
  }
  return ok(200, { period });
}
