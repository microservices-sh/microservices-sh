import type { BankReconciliationStore } from "../ports";
import type {
  BankAccount,
  BankStatementImport,
  BankStatementImportFieldMapping,
  BankStatementImportSource,
  BankStatementImportStatus,
  BankTransaction,
  BankTransactionMatch,
  BankTransactionMatchStatus,
  BankMatchTargetType,
  BankMatchType,
  ReconciliationSession,
  ReconciliationStatus
} from "../types";

const ACCOUNT_COLS = "id, tenant_id, name, bank_name, currency, opening_balance_cents, active, created_at, updated_at";
const IMPORT_COLS = `
  id,
  tenant_id,
  bank_account_id,
  source,
  file_name,
  total_rows,
  imported_rows,
  skipped_rows,
  duplicate_rows,
  start_date,
  end_date,
  field_mapping,
  status,
  error_message,
  imported_by_id,
  imported_at,
  created_at
`;
const TX_SELECT = `
  tx.id,
  tx.tenant_id,
  tx.bank_account_id,
  tx.statement_import_id,
  tx.transaction_date,
  tx.description,
  tx.amount_cents,
  tx.transaction_hash,
  tx.match_status,
  tx.reconciled,
  tx.reconciled_at,
  tx.reconciliation_id,
  tx.created_at,
  (
    SELECT m.target_id
    FROM bank_reconciliation_matches m
    WHERE m.tenant_id = tx.tenant_id
      AND m.bank_transaction_id = tx.id
      AND m.target_type = 'ledger_line'
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS ledger_reference_id
`;
const RECONCILIATION_COLS = `
  id,
  tenant_id,
  bank_account_id,
  statement_date,
  period_start,
  period_end,
  opening_balance_cents,
  statement_ending_balance_cents,
  cleared_deposits_cents,
  cleared_withdrawals_cents,
  cleared_balance_cents,
  difference_cents,
  transactions_cleared,
  transactions_unmatched,
  status,
  completed_at,
  created_at,
  updated_at
`;
const MATCH_COLS = `
  id,
  tenant_id,
  bank_transaction_id,
  target_type,
  target_id,
  target_ref,
  target_date,
  target_amount_cents,
  description,
  match_type,
  confidence,
  amount_matched_cents,
  confirmed,
  confirmed_at,
  confirmed_by_id,
  reconciliation_id,
  created_at
`;

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function optionalNumber(value: unknown): number | undefined {
  return value == null ? undefined : Number(value);
}

function toBankAccount(row: Record<string, unknown>): BankAccount {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    bankName: optionalString(row.bank_name),
    currency: String(row.currency),
    openingBalanceCents: Number(row.opening_balance_cents ?? 0),
    active: Number(row.active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function parseFieldMapping(value: unknown): BankStatementImportFieldMapping | undefined {
  if (value == null) return undefined;
  try {
    const parsed = JSON.parse(String(value)) as Partial<BankStatementImportFieldMapping>;
    if (!parsed.date || !parsed.description) return undefined;
    return {
      date: String(parsed.date),
      description: String(parsed.description),
      amount: optionalString(parsed.amount),
      debit: optionalString(parsed.debit),
      credit: optionalString(parsed.credit)
    };
  } catch {
    return undefined;
  }
}

function toStatementImport(row: Record<string, unknown>): BankStatementImport {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    bankAccountId: String(row.bank_account_id),
    source: String(row.source) as BankStatementImportSource,
    fileName: optionalString(row.file_name),
    totalRows: Number(row.total_rows ?? 0),
    importedRows: Number(row.imported_rows ?? 0),
    skippedRows: Number(row.skipped_rows ?? 0),
    duplicateRows: Number(row.duplicate_rows ?? 0),
    startDate: optionalString(row.start_date),
    endDate: optionalString(row.end_date),
    fieldMapping: parseFieldMapping(row.field_mapping),
    status: String(row.status) as BankStatementImportStatus,
    errorMessage: optionalString(row.error_message),
    importedById: optionalString(row.imported_by_id),
    importedAt: optionalString(row.imported_at),
    createdAt: String(row.created_at)
  };
}

function toBankTransaction(row: Record<string, unknown>): BankTransaction {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    bankAccountId: String(row.bank_account_id),
    statementImportId: optionalString(row.statement_import_id),
    transactionDate: String(row.transaction_date),
    description: String(row.description),
    amountCents: Number(row.amount_cents),
    transactionHash: String(row.transaction_hash),
    matchStatus: String(row.match_status) as BankTransactionMatchStatus,
    ledgerReferenceId: optionalString(row.ledger_reference_id),
    reconciled: Number(row.reconciled ?? 0) === 1,
    reconciledAt: optionalString(row.reconciled_at),
    reconciliationId: optionalString(row.reconciliation_id),
    createdAt: String(row.created_at)
  };
}

function toMatch(row: Record<string, unknown>): BankTransactionMatch {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    bankTransactionId: String(row.bank_transaction_id),
    targetType: String(row.target_type) as BankMatchTargetType,
    targetId: String(row.target_id),
    targetRef: optionalString(row.target_ref) ?? null,
    targetDate: optionalString(row.target_date) ?? null,
    targetAmountCents: Number(row.target_amount_cents),
    description: optionalString(row.description) ?? null,
    matchType: String(row.match_type) as BankMatchType,
    confidence: row.confidence == null ? null : Number(row.confidence),
    amountMatchedCents: Number(row.amount_matched_cents),
    confirmed: Number(row.confirmed ?? 0) === 1,
    confirmedAt: optionalString(row.confirmed_at) ?? null,
    confirmedById: optionalString(row.confirmed_by_id) ?? null,
    reconciliationId: optionalString(row.reconciliation_id) ?? null,
    createdAt: String(row.created_at)
  };
}

function toReconciliation(row: Record<string, unknown>): ReconciliationSession {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    bankAccountId: String(row.bank_account_id),
    periodStart: optionalString(row.period_start),
    periodEnd: optionalString(row.period_end),
    openingBalanceCents: optionalNumber(row.opening_balance_cents),
    statementDate: String(row.statement_date),
    statementBalanceCents: Number(row.statement_ending_balance_cents),
    clearedDepositsCents: optionalNumber(row.cleared_deposits_cents),
    clearedWithdrawalsCents: optionalNumber(row.cleared_withdrawals_cents),
    clearedBalanceCents: optionalNumber(row.cleared_balance_cents),
    differenceCents: optionalNumber(row.difference_cents),
    transactionsCleared: optionalNumber(row.transactions_cleared),
    transactionsUnmatched: optionalNumber(row.transactions_unmatched),
    status: String(row.status) as ReconciliationStatus,
    completedAt: optionalString(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: optionalString(row.updated_at)
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

function reconciliationDefaults(session: ReconciliationSession) {
  const openingBalanceCents = session.openingBalanceCents ?? 0;
  const clearedBalanceCents = session.clearedBalanceCents ?? openingBalanceCents;
  return {
    periodStart: session.periodStart ?? session.statementDate,
    periodEnd: session.periodEnd ?? session.statementDate,
    openingBalanceCents,
    clearedDepositsCents: session.clearedDepositsCents ?? 0,
    clearedWithdrawalsCents: session.clearedWithdrawalsCents ?? 0,
    clearedBalanceCents,
    differenceCents: session.differenceCents ?? session.statementBalanceCents - clearedBalanceCents,
    transactionsCleared: session.transactionsCleared ?? 0,
    transactionsUnmatched: session.transactionsUnmatched ?? 0,
    updatedAt: session.updatedAt ?? session.completedAt ?? session.createdAt
  };
}

export function createD1BankReconciliationStore(db: D1Database): BankReconciliationStore {
  return {
    async insertBankAccount(account) {
      await db
        .prepare(
          `INSERT INTO bank_reconciliation_accounts (${ACCOUNT_COLS}, current_balance_cents, last_reconciled_balance_cents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          account.id,
          account.tenantId,
          account.name,
          account.bankName ?? null,
          account.currency,
          account.openingBalanceCents,
          account.active ? 1 : 0,
          account.createdAt,
          account.updatedAt,
          account.openingBalanceCents,
          account.openingBalanceCents
        )
        .run();
    },

    async getBankAccount(tenantId, bankAccountId) {
      const row = await db
        .prepare(`SELECT ${ACCOUNT_COLS} FROM bank_reconciliation_accounts WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, bankAccountId)
        .first<Record<string, unknown>>();
      return row ? toBankAccount(row) : null;
    },

    async listBankAccounts(tenantId) {
      const result = await db
        .prepare(`SELECT ${ACCOUNT_COLS} FROM bank_reconciliation_accounts WHERE tenant_id = ? ORDER BY created_at ASC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toBankAccount);
    },

    async insertStatementImport(statementImport) {
      await db
        .prepare(
          `INSERT INTO bank_reconciliation_imports (${IMPORT_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          statementImport.id,
          statementImport.tenantId,
          statementImport.bankAccountId,
          statementImport.source,
          statementImport.fileName ?? null,
          statementImport.totalRows,
          statementImport.importedRows,
          statementImport.skippedRows,
          statementImport.duplicateRows,
          statementImport.startDate ?? null,
          statementImport.endDate ?? null,
          statementImport.fieldMapping ? JSON.stringify(statementImport.fieldMapping) : null,
          statementImport.status,
          statementImport.errorMessage ?? null,
          statementImport.importedById ?? null,
          statementImport.importedAt ?? null,
          statementImport.createdAt
        )
        .run();
    },

    async updateStatementImport(statementImport) {
      await db
        .prepare(
          `UPDATE bank_reconciliation_imports
           SET total_rows = ?,
               imported_rows = ?,
               skipped_rows = ?,
               duplicate_rows = ?,
               start_date = ?,
               end_date = ?,
               field_mapping = ?,
               status = ?,
               error_message = ?,
               imported_by_id = ?,
               imported_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          statementImport.totalRows,
          statementImport.importedRows,
          statementImport.skippedRows,
          statementImport.duplicateRows,
          statementImport.startDate ?? null,
          statementImport.endDate ?? null,
          statementImport.fieldMapping ? JSON.stringify(statementImport.fieldMapping) : null,
          statementImport.status,
          statementImport.errorMessage ?? null,
          statementImport.importedById ?? null,
          statementImport.importedAt ?? null,
          statementImport.tenantId,
          statementImport.id
        )
        .run();
    },

    async listStatementImports(tenantId, bankAccountId) {
      const result = bankAccountId
        ? await db
            .prepare(
              `SELECT ${IMPORT_COLS}
               FROM bank_reconciliation_imports
               WHERE tenant_id = ? AND bank_account_id = ?
               ORDER BY created_at ASC`
            )
            .bind(tenantId, bankAccountId)
            .all<Record<string, unknown>>()
        : await db
            .prepare(
              `SELECT ${IMPORT_COLS}
               FROM bank_reconciliation_imports
               WHERE tenant_id = ?
               ORDER BY created_at ASC`
            )
            .bind(tenantId)
            .all<Record<string, unknown>>();
      return (result.results ?? []).map(toStatementImport);
    },

    async insertTransaction(transaction) {
      try {
        await db
          .prepare(
            `INSERT INTO bank_reconciliation_transactions (
              id,
              tenant_id,
              bank_account_id,
              statement_import_id,
              transaction_date,
              description,
              amount_cents,
              transaction_hash,
              match_status,
              reconciled,
              reconciled_at,
              reconciliation_id,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            transaction.id,
            transaction.tenantId,
            transaction.bankAccountId,
            transaction.statementImportId ?? null,
            transaction.transactionDate,
            transaction.description,
            transaction.amountCents,
            transaction.transactionHash,
            transaction.matchStatus,
            transaction.reconciled ? 1 : 0,
            transaction.reconciledAt ?? null,
            transaction.reconciliationId ?? null,
            transaction.createdAt,
            transaction.createdAt
          )
          .run();
        return true;
      } catch (error) {
        if (isUniqueConstraintError(error)) return false;
        throw error;
      }
    },

    async getTransaction(tenantId, transactionId) {
      const row = await db
        .prepare(`SELECT ${TX_SELECT} FROM bank_reconciliation_transactions tx WHERE tx.tenant_id = ? AND tx.id = ?`)
        .bind(tenantId, transactionId)
        .first<Record<string, unknown>>();
      return row ? toBankTransaction(row) : null;
    },

    async getTransactionByHash(tenantId, bankAccountId, transactionHash) {
      const row = await db
        .prepare(
          `SELECT ${TX_SELECT}
           FROM bank_reconciliation_transactions tx
           WHERE tx.tenant_id = ? AND tx.bank_account_id = ? AND tx.transaction_hash = ?`
        )
        .bind(tenantId, bankAccountId, transactionHash)
        .first<Record<string, unknown>>();
      return row ? toBankTransaction(row) : null;
    },

    async listStatementTransactions(tenantId, bankAccountId) {
      const result = await db
        .prepare(
          `SELECT ${TX_SELECT}
           FROM bank_reconciliation_transactions tx
           WHERE tx.tenant_id = ? AND tx.bank_account_id = ?
           ORDER BY tx.transaction_date ASC, tx.created_at ASC`
        )
        .bind(tenantId, bankAccountId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toBankTransaction);
    },

    async listTransactionsForReconciliation(tenantId, bankAccountId, statementDate) {
      const result = await db
        .prepare(
          `SELECT ${TX_SELECT}
           FROM bank_reconciliation_transactions tx
           WHERE tx.tenant_id = ? AND tx.bank_account_id = ? AND tx.transaction_date <= ?
           ORDER BY tx.transaction_date ASC, tx.created_at ASC`
        )
        .bind(tenantId, bankAccountId, statementDate)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toBankTransaction);
    },

    async updateTransaction(transaction) {
      const updatedAt = transaction.reconciledAt ?? new Date().toISOString();
      await db
        .prepare(
          `UPDATE bank_reconciliation_transactions
           SET match_status = ?, reconciled = ?, reconciled_at = ?, reconciliation_id = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          transaction.matchStatus,
          transaction.reconciled ? 1 : 0,
          transaction.reconciledAt ?? null,
          transaction.reconciliationId ?? null,
          updatedAt,
          transaction.tenantId,
          transaction.id
        )
        .run();

    },

    async updateTransactions(transactions) {
      for (const transaction of transactions) {
        const updatedAt = transaction.reconciledAt ?? new Date().toISOString();
        await db
          .prepare(
            `UPDATE bank_reconciliation_transactions
             SET match_status = ?, reconciled = ?, reconciled_at = ?, reconciliation_id = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?`
          )
          .bind(
            transaction.matchStatus,
            transaction.reconciled ? 1 : 0,
            transaction.reconciledAt ?? null,
            transaction.reconciliationId ?? null,
            updatedAt,
            transaction.tenantId,
            transaction.id
          )
          .run();
      }
    },

    async upsertMatch(match) {
      await db
        .prepare(
          `INSERT INTO bank_reconciliation_matches (${MATCH_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, bank_transaction_id, target_type, target_id)
           DO UPDATE SET
             target_ref = excluded.target_ref,
             target_date = excluded.target_date,
             target_amount_cents = excluded.target_amount_cents,
             description = excluded.description,
             match_type = excluded.match_type,
             confidence = excluded.confidence,
             amount_matched_cents = excluded.amount_matched_cents,
             confirmed = excluded.confirmed,
             confirmed_at = excluded.confirmed_at,
             confirmed_by_id = excluded.confirmed_by_id,
             reconciliation_id = excluded.reconciliation_id`
        )
        .bind(
          match.id,
          match.tenantId,
          match.bankTransactionId,
          match.targetType,
          match.targetId,
          match.targetRef ?? null,
          match.targetDate ?? null,
          match.targetAmountCents,
          match.description ?? null,
          match.matchType,
          match.confidence ?? null,
          match.amountMatchedCents,
          match.confirmed ? 1 : 0,
          match.confirmedAt ?? null,
          match.confirmedById ?? null,
          match.reconciliationId ?? null,
          match.createdAt
        )
        .run();
    },

    async listMatchesForTransaction(tenantId, transactionId) {
      const result = await db
        .prepare(
          `SELECT ${MATCH_COLS}
           FROM bank_reconciliation_matches
           WHERE tenant_id = ? AND bank_transaction_id = ?
           ORDER BY created_at ASC`
        )
        .bind(tenantId, transactionId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toMatch);
    },

    async insertReconciliation(session) {
      const defaults = reconciliationDefaults(session);
      await db
        .prepare(
          `INSERT INTO bank_reconciliation_sessions (${RECONCILIATION_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          session.id,
          session.tenantId,
          session.bankAccountId,
          session.statementDate,
          defaults.periodStart,
          defaults.periodEnd,
          defaults.openingBalanceCents,
          session.statementBalanceCents,
          defaults.clearedDepositsCents,
          defaults.clearedWithdrawalsCents,
          defaults.clearedBalanceCents,
          defaults.differenceCents,
          defaults.transactionsCleared,
          defaults.transactionsUnmatched,
          session.status,
          session.completedAt ?? null,
          session.createdAt,
          defaults.updatedAt
        )
        .run();
    },

    async getReconciliation(tenantId, reconciliationId) {
      const row = await db
        .prepare(`SELECT ${RECONCILIATION_COLS} FROM bank_reconciliation_sessions WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, reconciliationId)
        .first<Record<string, unknown>>();
      return row ? toReconciliation(row) : null;
    },

    async listReconciliations(tenantId, bankAccountId) {
      const result = bankAccountId
        ? await db
            .prepare(
              `SELECT ${RECONCILIATION_COLS}
               FROM bank_reconciliation_sessions
               WHERE tenant_id = ? AND bank_account_id = ?
               ORDER BY created_at DESC`
            )
            .bind(tenantId, bankAccountId)
            .all<Record<string, unknown>>()
        : await db
            .prepare(
              `SELECT ${RECONCILIATION_COLS}
               FROM bank_reconciliation_sessions
               WHERE tenant_id = ?
               ORDER BY created_at DESC`
            )
            .bind(tenantId)
            .all<Record<string, unknown>>();
      return (result.results ?? []).map(toReconciliation);
    },

    async updateReconciliation(session) {
      const defaults = reconciliationDefaults(session);
      await db
        .prepare(
          `UPDATE bank_reconciliation_sessions
           SET status = ?,
               completed_at = ?,
               cleared_deposits_cents = ?,
               cleared_withdrawals_cents = ?,
               cleared_balance_cents = ?,
               difference_cents = ?,
               transactions_cleared = ?,
               transactions_unmatched = ?,
               updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          session.status,
          session.completedAt ?? null,
          defaults.clearedDepositsCents,
          defaults.clearedWithdrawalsCents,
          defaults.clearedBalanceCents,
          defaults.differenceCents,
          defaults.transactionsCleared,
          defaults.transactionsUnmatched,
          defaults.updatedAt,
          session.tenantId,
          session.id
        )
        .run();
    }
  };
}
