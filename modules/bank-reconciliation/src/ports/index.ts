import type { BankAccount, BankTransaction, ReconciliationSession } from "../types";

export interface BankReconciliationStore {
  insertBankAccount(account: BankAccount): Promise<void>;
  insertTransactions(transactions: BankTransaction[]): Promise<void>;
  insertReconciliation(session: ReconciliationSession): Promise<void>;
}
