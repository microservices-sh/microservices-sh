import type {
  BankAccount,
  BankTransaction,
  ModuleResult,
  ReconciliationSession,
  StatementImportResult,
  TenantContext
} from "../types";

interface CreateBankAccountInput {
  name: string;
  bankName?: string;
  currency?: string;
  openingBalanceCents?: number;
}

interface StatementTransactionInput {
  transactionDate: string;
  description: string;
  amountCents: number;
  transactionHash: string;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createBankReconciliationMemoryService() {
  const accounts = new Map<string, BankAccount>();
  const transactions = new Map<string, BankTransaction>();
  const transactionHashes = new Set<string>();
  const reconciliations = new Map<string, ReconciliationSession>();
  let accountSequence = 0;
  let transactionSequence = 0;
  let reconciliationSequence = 0;

  return {
    createBankAccount(ctx: TenantContext, input: CreateBankAccountInput): ModuleResult<BankAccount> {
      const createdAt = now(ctx);
      const account: BankAccount = {
        id: id("bank", ++accountSequence),
        tenantId: ctx.tenantId,
        name: input.name,
        bankName: input.bankName,
        currency: input.currency ?? "USD",
        openingBalanceCents: input.openingBalanceCents ?? 0,
        active: true,
        createdAt,
        updatedAt: createdAt
      };
      if (!account.name.trim()) return fail("bank_account_name_required", "Bank account name is required.");
      accounts.set(account.id, account);
      return ok(account);
    },

    listBankAccounts(ctx: TenantContext): ModuleResult<BankAccount[]> {
      return ok([...accounts.values()].filter((account) => account.tenantId === ctx.tenantId));
    },

    importStatementTransactions(ctx: TenantContext, bankAccountId: string, rows: StatementTransactionInput[]): ModuleResult<StatementImportResult> {
      const account = accounts.get(bankAccountId);
      if (!account || account.tenantId !== ctx.tenantId) return fail("bank_account_not_found", "Bank account not found.");
      const imported: BankTransaction[] = [];
      let skippedDuplicateCount = 0;
      for (const row of rows) {
        const hashKey = `${ctx.tenantId}:${bankAccountId}:${row.transactionHash}`;
        if (transactionHashes.has(hashKey)) {
          skippedDuplicateCount += 1;
          continue;
        }
        const transaction: BankTransaction = {
          id: id("btx", ++transactionSequence),
          tenantId: ctx.tenantId,
          bankAccountId,
          transactionDate: row.transactionDate,
          description: row.description,
          amountCents: row.amountCents,
          transactionHash: row.transactionHash,
          matchStatus: "unmatched",
          reconciled: false,
          createdAt: now(ctx)
        };
        transactionHashes.add(hashKey);
        transactions.set(transaction.id, transaction);
        imported.push(transaction);
      }
      return ok({ imported, importedCount: imported.length, skippedDuplicateCount });
    },

    listStatementTransactions(ctx: TenantContext, bankAccountId: string): ModuleResult<BankTransaction[]> {
      return ok([...transactions.values()].filter((tx) => tx.tenantId === ctx.tenantId && tx.bankAccountId === bankAccountId));
    },

    matchTransaction(ctx: TenantContext, transactionId: string, ledgerReferenceId: string): ModuleResult<BankTransaction> {
      const transaction = transactions.get(transactionId);
      if (!transaction || transaction.tenantId !== ctx.tenantId) return fail("transaction_not_found", "Bank transaction not found.");
      if (transaction.reconciled) return fail("transaction_reconciled", "Reconciled transactions cannot be rematched.");
      const updated: BankTransaction = { ...transaction, ledgerReferenceId, matchStatus: "manual_matched" };
      transactions.set(updated.id, updated);
      return ok(updated);
    },

    startReconciliation(ctx: TenantContext, bankAccountId: string, statementDate: string, statementBalanceCents: number): ModuleResult<ReconciliationSession> {
      const account = accounts.get(bankAccountId);
      if (!account || account.tenantId !== ctx.tenantId) return fail("bank_account_not_found", "Bank account not found.");
      const createdAt = now(ctx);
      const reconciliation: ReconciliationSession = {
        id: id("recon", ++reconciliationSequence),
        tenantId: ctx.tenantId,
        bankAccountId,
        statementDate,
        statementBalanceCents,
        status: "in_progress",
        createdAt
      };
      reconciliations.set(reconciliation.id, reconciliation);
      return ok(reconciliation);
    },

    completeReconciliation(ctx: TenantContext, reconciliationId: string): ModuleResult<ReconciliationSession> {
      const reconciliation = reconciliations.get(reconciliationId);
      if (!reconciliation || reconciliation.tenantId !== ctx.tenantId) return fail("reconciliation_not_found", "Reconciliation not found.");
      const account = accounts.get(reconciliation.bankAccountId)!;
      const scopedTransactions = [...transactions.values()].filter(
        (tx) => tx.tenantId === ctx.tenantId && tx.bankAccountId === reconciliation.bankAccountId && tx.transactionDate <= reconciliation.statementDate
      );
      const unmatched = scopedTransactions.filter((tx) => tx.matchStatus === "unmatched");
      if (unmatched.length > 0) return fail("unmatched_transactions", "Cannot complete reconciliation while unmatched transactions remain.");
      const clearedBalance = scopedTransactions.reduce((sum, tx) => sum + tx.amountCents, account.openingBalanceCents);
      if (clearedBalance !== reconciliation.statementBalanceCents) {
        return fail("balance_mismatch", "Cleared balance must match statement balance.");
      }
      for (const tx of scopedTransactions) transactions.set(tx.id, { ...tx, reconciled: true });
      const completed: ReconciliationSession = { ...reconciliation, status: "completed", completedAt: now(ctx) };
      reconciliations.set(completed.id, completed);
      return ok(completed);
    }
  };
}

export function getBankReconciliationModuleStatus() {
  return { id: "bank-reconciliation", status: "draft" } as const;
}
