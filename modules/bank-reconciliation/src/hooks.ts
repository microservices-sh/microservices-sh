import type { BankAccount, BankTransaction, ReconciliationSession } from "./types";

export interface BankReconciliationHooks {
  beforeBankAccountCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeStatementImport?: (input: unknown) => Promise<unknown> | unknown;
  beforeTransactionMatch?: (input: unknown) => Promise<unknown> | unknown;
  beforeReconciliationComplete?: (input: unknown) => Promise<unknown> | unknown;
  afterBankAccountChanged?: (account: BankAccount) => Promise<void> | void;
  afterStatementTransactionsImported?: (transactions: BankTransaction[]) => Promise<void> | void;
  afterReconciliationChanged?: (reconciliation: ReconciliationSession) => Promise<void> | void;
}

export const defaultBankReconciliationHooks: Required<BankReconciliationHooks> = {
  beforeBankAccountCreate(input) {
    return input;
  },
  beforeStatementImport(input) {
    return input;
  },
  beforeTransactionMatch(input) {
    return input;
  },
  beforeReconciliationComplete(input) {
    return input;
  },
  afterBankAccountChanged() {
    return undefined;
  },
  afterStatementTransactionsImported() {
    return undefined;
  },
  afterReconciliationChanged() {
    return undefined;
  }
};
