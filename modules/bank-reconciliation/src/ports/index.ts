import type { BankAccount, BankStatementImport, BankTransaction, BankTransactionMatch, ReconciliationSession } from "../types";

export interface BankReconciliationStore {
  insertBankAccount(account: BankAccount): Promise<void>;
  getBankAccount(tenantId: string, bankAccountId: string): Promise<BankAccount | null>;
  listBankAccounts(tenantId: string): Promise<BankAccount[]>;

  insertStatementImport(statementImport: BankStatementImport): Promise<void>;
  updateStatementImport(statementImport: BankStatementImport): Promise<void>;
  listStatementImports(tenantId: string, bankAccountId?: string): Promise<BankStatementImport[]>;

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
  upsertMatch(match: BankTransactionMatch): Promise<void>;
  listMatchesForTransaction(tenantId: string, transactionId: string): Promise<BankTransactionMatch[]>;

  insertReconciliation(session: ReconciliationSession): Promise<void>;
  getReconciliation(tenantId: string, reconciliationId: string): Promise<ReconciliationSession | null>;
  listReconciliations(tenantId: string, bankAccountId?: string): Promise<ReconciliationSession[]>;
  updateReconciliation(session: ReconciliationSession): Promise<void>;
}
