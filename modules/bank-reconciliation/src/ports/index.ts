import type { BankAccount, BankTransaction, ReconciliationSession } from "../types";

export interface BankReconciliationStore {
  insertBankAccount(account: BankAccount): Promise<void>;
  getBankAccount(tenantId: string, bankAccountId: string): Promise<BankAccount | null>;
  listBankAccounts(tenantId: string): Promise<BankAccount[]>;

  /**
   * Inserts a statement transaction and returns false when the tenant/account/hash
   * idempotency key already exists.
   */
  insertTransaction(transaction: BankTransaction): Promise<boolean>;
  getTransaction(tenantId: string, transactionId: string): Promise<BankTransaction | null>;
  getTransactionByHash(tenantId: string, bankAccountId: string, transactionHash: string): Promise<BankTransaction | null>;
  listStatementTransactions(tenantId: string, bankAccountId: string): Promise<BankTransaction[]>;
  listTransactionsForReconciliation(tenantId: string, bankAccountId: string, statementDate: string): Promise<BankTransaction[]>;
  updateTransaction(transaction: BankTransaction): Promise<void>;
  updateTransactions(transactions: BankTransaction[]): Promise<void>;

  insertReconciliation(session: ReconciliationSession): Promise<void>;
  getReconciliation(tenantId: string, reconciliationId: string): Promise<ReconciliationSession | null>;
  updateReconciliation(session: ReconciliationSession): Promise<void>;
}
