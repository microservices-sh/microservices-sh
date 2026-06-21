import type { BankReconciliationStore } from "../ports";
import type { BankAccount, BankTransaction, ReconciliationSession } from "../types";

function transactionHashKey(transaction: Pick<BankTransaction, "tenantId" | "bankAccountId" | "transactionHash">): string {
  return `${transaction.tenantId}:${transaction.bankAccountId}:${transaction.transactionHash}`;
}

function copyAccount(account: BankAccount): BankAccount {
  return { ...account };
}

function copyTransaction(transaction: BankTransaction): BankTransaction {
  return { ...transaction };
}

function copyReconciliation(session: ReconciliationSession): ReconciliationSession {
  return { ...session };
}

export function createMemoryBankReconciliationStore(): BankReconciliationStore {
  const accounts = new Map<string, BankAccount>();
  const transactions = new Map<string, BankTransaction>();
  const transactionHashes = new Map<string, string>();
  const reconciliations = new Map<string, ReconciliationSession>();

  return {
    async insertBankAccount(account) {
      accounts.set(account.id, copyAccount(account));
    },

    async getBankAccount(tenantId, bankAccountId) {
      const account = accounts.get(bankAccountId);
      return account && account.tenantId === tenantId ? copyAccount(account) : null;
    },

    async listBankAccounts(tenantId) {
      return [...accounts.values()].filter((account) => account.tenantId === tenantId).map(copyAccount);
    },

    async insertTransaction(transaction) {
      const hashKey = transactionHashKey(transaction);
      if (transactionHashes.has(hashKey)) return false;
      transactions.set(transaction.id, copyTransaction(transaction));
      transactionHashes.set(hashKey, transaction.id);
      return true;
    },

    async getTransaction(tenantId, transactionId) {
      const transaction = transactions.get(transactionId);
      return transaction && transaction.tenantId === tenantId ? copyTransaction(transaction) : null;
    },

    async getTransactionByHash(tenantId, bankAccountId, transactionHash) {
      const transactionId = transactionHashes.get(`${tenantId}:${bankAccountId}:${transactionHash}`);
      if (!transactionId) return null;
      const transaction = transactions.get(transactionId);
      return transaction ? copyTransaction(transaction) : null;
    },

    async listStatementTransactions(tenantId, bankAccountId) {
      return [...transactions.values()]
        .filter((transaction) => transaction.tenantId === tenantId && transaction.bankAccountId === bankAccountId)
        .map(copyTransaction);
    },

    async listTransactionsForReconciliation(tenantId, bankAccountId, statementDate) {
      return [...transactions.values()]
        .filter(
          (transaction) =>
            transaction.tenantId === tenantId &&
            transaction.bankAccountId === bankAccountId &&
            transaction.transactionDate <= statementDate
        )
        .map(copyTransaction);
    },

    async updateTransaction(transaction) {
      const existing = transactions.get(transaction.id);
      if (!existing || existing.tenantId !== transaction.tenantId) return;
      transactions.set(transaction.id, copyTransaction(transaction));
    },

    async updateTransactions(nextTransactions) {
      for (const transaction of nextTransactions) {
        await this.updateTransaction(transaction);
      }
    },

    async insertReconciliation(session) {
      reconciliations.set(session.id, copyReconciliation(session));
    },

    async getReconciliation(tenantId, reconciliationId) {
      const session = reconciliations.get(reconciliationId);
      return session && session.tenantId === tenantId ? copyReconciliation(session) : null;
    },

    async updateReconciliation(session) {
      const existing = reconciliations.get(session.id);
      if (!existing || existing.tenantId !== session.tenantId) return;
      reconciliations.set(session.id, copyReconciliation(session));
    }
  };
}
