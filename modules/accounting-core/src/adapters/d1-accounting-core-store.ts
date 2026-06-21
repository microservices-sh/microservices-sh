import type { AccountingCoreStore } from "../ports";
import { accountingId } from "../service";
import type {
  Account,
  AccountingEvent,
  AccountFilter,
  AccountType,
  FiscalPeriod,
  FiscalPeriodFilter,
  FiscalPeriodStatus,
  JournalEntry,
  JournalEntryStatus,
  JournalLine,
  NormalBalance,
  TrialBalanceFilter,
  TrialBalancePosting
} from "../types";

function rowBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    type: String(row.type) as AccountType,
    normalBalance: String(row.normal_balance) as NormalBalance,
    description: nullableString(row.description),
    active: rowBool(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToFiscalPeriod(row: Record<string, unknown>): FiscalPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    status: String(row.status) as FiscalPeriodStatus,
    closedAt: nullableString(row.closed_at),
    lockedAt: nullableString(row.locked_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToJournalEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    periodId: String(row.period_id),
    entryDate: String(row.entry_date),
    description: nullableString(row.description),
    status: String(row.status) as JournalEntryStatus,
    sourceRef: nullableString(row.source_ref),
    sourceType: nullableString(row.source_type),
    postedAt: nullableString(row.posted_at),
    postedById: nullableString(row.posted_by_id),
    voidedAt: nullableString(row.voided_at),
    voidedById: nullableString(row.voided_by_id),
    voidReason: nullableString(row.void_reason),
    reversalEntryId: nullableString(row.reversal_entry_id),
    reversesEntryId: nullableString(row.reverses_entry_id),
    createdById: nullableString(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToJournalLine(row: Record<string, unknown>): JournalLine {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    entryId: String(row.entry_id),
    accountId: String(row.account_id),
    description: nullableString(row.description),
    debitCents: Number(row.debit_cents ?? 0),
    creditCents: Number(row.credit_cents ?? 0),
    createdAt: String(row.created_at)
  };
}

function rowToTrialBalancePosting(row: Record<string, unknown>): TrialBalancePosting {
  return {
    account: {
      id: String(row.account_id),
      tenantId: String(row.tenant_id),
      code: String(row.code),
      name: String(row.name),
      type: String(row.type) as AccountType,
      normalBalance: String(row.normal_balance) as NormalBalance,
      description: nullableString(row.description),
      active: rowBool(row.active),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    },
    rawDebitCents: Number(row.raw_debit_cents ?? 0),
    rawCreditCents: Number(row.raw_credit_cents ?? 0)
  };
}

const ACCOUNT_COLS =
  "id, tenant_id, code, name, type, normal_balance, description, active, created_at, updated_at";
const PERIOD_COLS =
  "id, tenant_id, name, starts_on, ends_on, status, closed_at, locked_at, created_at, updated_at";
const ENTRY_COLS =
  "id, tenant_id, period_id, entry_date, description, status, source_ref, source_type, posted_at, posted_by_id, voided_at, voided_by_id, void_reason, reversal_entry_id, reverses_entry_id, created_by_id, created_at, updated_at";
const LINE_COLS = "id, tenant_id, entry_id, account_id, description, debit_cents, credit_cents, created_at";

async function insertJournalLines(db: D1Database, lines: JournalLine[]): Promise<void> {
  for (const line of lines) {
    await db
      .prepare(`INSERT INTO accounting_journal_lines (${LINE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        line.id,
        line.tenantId,
        line.entryId,
        line.accountId,
        line.description,
        line.debitCents,
        line.creditCents,
        line.createdAt
      )
      .run();
  }
}

async function insertJournalEntryRecord(db: D1Database, entry: JournalEntry): Promise<void> {
  await db
    .prepare(`INSERT INTO accounting_journal_entries (${ENTRY_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      entry.id,
      entry.tenantId,
      entry.periodId,
      entry.entryDate,
      entry.description,
      entry.status,
      entry.sourceRef,
      entry.sourceType,
      entry.postedAt,
      entry.postedById,
      entry.voidedAt,
      entry.voidedById,
      entry.voidReason,
      entry.reversalEntryId,
      entry.reversesEntryId,
      entry.createdById,
      entry.createdAt,
      entry.updatedAt
    )
    .run();
}

async function updateJournalEntryRecord(db: D1Database, entry: JournalEntry): Promise<void> {
  await db
    .prepare(
      `UPDATE accounting_journal_entries SET period_id = ?, entry_date = ?, description = ?, status = ?,
         source_ref = ?, source_type = ?, posted_at = ?, posted_by_id = ?, voided_at = ?, voided_by_id = ?,
         void_reason = ?, reversal_entry_id = ?, reverses_entry_id = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    )
    .bind(
      entry.periodId,
      entry.entryDate,
      entry.description,
      entry.status,
      entry.sourceRef,
      entry.sourceType,
      entry.postedAt,
      entry.postedById,
      entry.voidedAt,
      entry.voidedById,
      entry.voidReason,
      entry.reversalEntryId,
      entry.reversesEntryId,
      entry.updatedAt,
      entry.tenantId,
      entry.id
    )
    .run();
}

export function createD1AccountingCoreStore(db: D1Database): AccountingCoreStore {
  return {
    async insertAccount(account) {
      await db
        .prepare(`INSERT INTO accounting_accounts (${ACCOUNT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          account.id,
          account.tenantId,
          account.code,
          account.name,
          account.type,
          account.normalBalance,
          account.description,
          account.active ? 1 : 0,
          account.createdAt,
          account.updatedAt
        )
        .run();
    },

    async updateAccount(account) {
      await db
        .prepare(
          `UPDATE accounting_accounts SET code = ?, name = ?, type = ?, normal_balance = ?, description = ?,
             active = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          account.code,
          account.name,
          account.type,
          account.normalBalance,
          account.description,
          account.active ? 1 : 0,
          account.updatedAt,
          account.tenantId,
          account.id
        )
        .run();
    },

    async getAccount(tenantId, accountId) {
      const row = await db
        .prepare(`SELECT ${ACCOUNT_COLS} FROM accounting_accounts WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, accountId)
        .first<Record<string, unknown>>();
      return row ? rowToAccount(row) : null;
    },

    async findAccountByCode(tenantId, code) {
      const row = await db
        .prepare(`SELECT ${ACCOUNT_COLS} FROM accounting_accounts WHERE tenant_id = ? AND code = ?`)
        .bind(tenantId, code)
        .first<Record<string, unknown>>();
      return row ? rowToAccount(row) : null;
    },

    async listAccounts(filter: AccountFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (!filter.includeInactive) clauses.push("active = 1");
      if (filter.type) {
        clauses.push("type = ?");
        binds.push(filter.type);
      }
      if (filter.search) {
        const search = `%${filter.search.toLowerCase()}%`;
        clauses.push("(LOWER(code) LIKE ? OR LOWER(name) LIKE ?)");
        binds.push(search, search);
      }
      const result = await db
        .prepare(`SELECT ${ACCOUNT_COLS} FROM accounting_accounts WHERE ${clauses.join(" AND ")} ORDER BY code ASC LIMIT ?`)
        .bind(...binds, filter.limit ?? 500)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToAccount);
    },

    async insertFiscalPeriod(period) {
      await db
        .prepare(`INSERT INTO accounting_fiscal_periods (${PERIOD_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          period.id,
          period.tenantId,
          period.name,
          period.startsOn,
          period.endsOn,
          period.status,
          period.closedAt,
          period.lockedAt,
          period.createdAt,
          period.updatedAt
        )
        .run();
    },

    async updateFiscalPeriod(period) {
      await db
        .prepare(
          `UPDATE accounting_fiscal_periods SET name = ?, starts_on = ?, ends_on = ?, status = ?,
             closed_at = ?, locked_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          period.name,
          period.startsOn,
          period.endsOn,
          period.status,
          period.closedAt,
          period.lockedAt,
          period.updatedAt,
          period.tenantId,
          period.id
        )
        .run();
    },

    async getFiscalPeriod(tenantId, periodId) {
      const row = await db
        .prepare(`SELECT ${PERIOD_COLS} FROM accounting_fiscal_periods WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, periodId)
        .first<Record<string, unknown>>();
      return row ? rowToFiscalPeriod(row) : null;
    },

    async listFiscalPeriods(filter: FiscalPeriodFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(`SELECT ${PERIOD_COLS} FROM accounting_fiscal_periods WHERE ${clauses.join(" AND ")} ORDER BY starts_on ASC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToFiscalPeriod);
    },

    async insertJournalEntry(entry, lines) {
      await insertJournalEntryRecord(db, entry);
      await insertJournalLines(db, lines);
    },

    async updateJournalEntry(entry, lines) {
      await updateJournalEntryRecord(db, entry);
      await db
        .prepare("DELETE FROM accounting_journal_lines WHERE tenant_id = ? AND entry_id = ?")
        .bind(entry.tenantId, entry.id)
        .run();
      await insertJournalLines(db, lines);
    },

    async getJournalEntry(tenantId, entryId) {
      const row = await db
        .prepare(`SELECT ${ENTRY_COLS} FROM accounting_journal_entries WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, entryId)
        .first<Record<string, unknown>>();
      return row ? rowToJournalEntry(row) : null;
    },

    async listJournalLines(tenantId, entryId) {
      const result = await db
        .prepare(`SELECT ${LINE_COLS} FROM accounting_journal_lines WHERE tenant_id = ? AND entry_id = ? ORDER BY rowid ASC`)
        .bind(tenantId, entryId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToJournalLine);
    },

    async findPostedEntryBySourceRef(tenantId, sourceRef, excludeEntryId) {
      const clauses = ["tenant_id = ?", "source_ref = ?", "status IN ('posted', 'void')"];
      const binds: unknown[] = [tenantId, sourceRef];
      if (excludeEntryId) {
        clauses.push("id <> ?");
        binds.push(excludeEntryId);
      }
      const row = await db
        .prepare(`SELECT ${ENTRY_COLS} FROM accounting_journal_entries WHERE ${clauses.join(" AND ")} LIMIT 1`)
        .bind(...binds)
        .first<Record<string, unknown>>();
      return row ? rowToJournalEntry(row) : null;
    },

    async voidJournalEntry(original, reversal, reversalLines) {
      await updateJournalEntryRecord(db, original);
      await insertJournalEntryRecord(db, reversal);
      await insertJournalLines(db, reversalLines);
    },

    async listTrialBalancePostings(filter: TrialBalanceFilter) {
      const clauses = ["e.tenant_id = ?", "e.status IN ('posted', 'void')"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.periodId) {
        clauses.push("e.period_id = ?");
        binds.push(filter.periodId);
      }
      if (filter.asOfDate) {
        clauses.push("e.entry_date <= ?");
        binds.push(filter.asOfDate);
      }
      const result = await db
        .prepare(
          `SELECT
             a.id AS account_id,
             a.tenant_id AS tenant_id,
             a.code AS code,
             a.name AS name,
             a.type AS type,
             a.normal_balance AS normal_balance,
             a.description AS description,
             a.active AS active,
             a.created_at AS created_at,
             a.updated_at AS updated_at,
             COALESCE(SUM(l.debit_cents), 0) AS raw_debit_cents,
             COALESCE(SUM(l.credit_cents), 0) AS raw_credit_cents
           FROM accounting_journal_lines l
           JOIN accounting_journal_entries e ON e.tenant_id = l.tenant_id AND e.id = l.entry_id
           JOIN accounting_accounts a ON a.tenant_id = l.tenant_id AND a.id = l.account_id
           WHERE ${clauses.join(" AND ")}
           GROUP BY a.id, a.tenant_id, a.code, a.name, a.type, a.normal_balance, a.description, a.active, a.created_at, a.updated_at
           ORDER BY a.code ASC`
        )
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToTrialBalancePosting);
    },

    async writeEvent(event) {
      await db
        .prepare(
          "INSERT INTO domain_events (id, event_type, aggregate_id, payload, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(accountingId("evt"), event.eventName, event.entityId, JSON.stringify(event))
        .run();
    }
  };
}
