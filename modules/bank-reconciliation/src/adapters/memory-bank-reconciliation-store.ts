import type { BankReconciliationStore } from "../ports";
import type { BankAccount, BankStatementImport, BankTransaction, BankTransactionMatch, ReconciliationSession } from "../types";

function transactionHashKey(transaction: Pick<BankTransaction, "tenantId" | "bankAccountId" | "transactionHash">): string {
  return `${transaction.tenantId}:${transaction.bankAccountId}:${transaction.transactionHash}`;
}

function copyAccount(account: BankAccount): BankAccount {
  return { ...account };
}

function copyTransaction(transaction: BankTransaction): BankTransaction {
  return { ...transaction };
}

function copyMatch(match: BankTransactionMatch): BankTransactionMatch {
  return { ...match };
}

function copyStatementImport(statementImport: BankStatementImport): BankStatementImport {
  return { ...statementImport, fieldMapping: statementImport.fieldMapping ? { ...statementImport.fieldMapping } : undefined };
}

function copyReconciliation(session: ReconciliationSession): ReconciliationSession {
  return { ...session };
}

export function createMemoryBankReconciliationStore(): BankReconciliationStore {
  const accounts = new Map<string, BankAccount>();
  const statementImports = new Map<string, BankStatementImport>();
  const transactions = new Map<string, BankTransaction>();
  const transactionHashes = new Map<string, string>();
  const matches = new Map<string, BankTransactionMatch>();
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

    async insertStatementImport(statementImport) {
      statementImports.set(statementImport.id, copyStatementImport(statementImport));
    },

    async updateStatementImport(statementImport) {
      const existing = statementImports.get(statementImport.id);
      if (!existing || existing.tenantId !== statementImport.tenantId) return;
      statementImports.set(statementImport.id, copyStatementImport(statementImport));
    },

    async listStatementImports(tenantId, bankAccountId) {
      return [...statementImports.values()]
        .filter(
          (statementImport) =>
            statementImport.tenantId === tenantId && (!bankAccountId || statementImport.bankAccountId === bankAccountId)
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(copyStatementImport);
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

    async upsertMatch(match) {
      const existing = [...matches.values()].find(
        (candidate) =>
          candidate.tenantId === match.tenantId &&
          candidate.bankTransactionId === match.bankTransactionId &&
          candidate.targetType === match.targetType &&
          candidate.targetId === match.targetId
      );
      if (existing) matches.delete(existing.id);
      matches.set(match.id, copyMatch(match));
    },

    async listMatchesForTransaction(tenantId, transactionId) {
      return [...matches.values()]
        .filter((match) => match.tenantId === tenantId && match.bankTransactionId === transactionId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(copyMatch);
    },

    async deleteMatchesForTransaction(tenantId, transactionId, matchId) {
      const removable = [...matches.values()].filter(
        (match) =>
          match.tenantId === tenantId &&
          match.bankTransactionId === transactionId &&
          (!matchId || match.id === matchId)
      );
      for (const match of removable) matches.delete(match.id);
      return removable.length;
    },

    async insertReconciliation(session) {
      reconciliations.set(session.id, copyReconciliation(session));
    },

    async getReconciliation(tenantId, reconciliationId) {
      const session = reconciliations.get(reconciliationId);
      return session && session.tenantId === tenantId ? copyReconciliation(session) : null;
    },

    async listReconciliations(tenantId, bankAccountId) {
      return [...reconciliations.values()]
        .filter((session) => session.tenantId === tenantId && (!bankAccountId || session.bankAccountId === bankAccountId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(copyReconciliation);
    },

    async updateReconciliation(session) {
      const existing = reconciliations.get(session.id);
      if (!existing || existing.tenantId !== session.tenantId) return;
      reconciliations.set(session.id, copyReconciliation(session));
    }
  };
}
