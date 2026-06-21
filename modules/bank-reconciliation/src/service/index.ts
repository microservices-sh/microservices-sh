import type {
  BankAccount,
  BankStatementImport,
  BankStatementImportFieldMapping,
  BankStatementImportSource,
  BankTransaction,
  BankTransactionMatch,
  CreateMatchInput,
  CreateMatchResult,
  MatchCandidate,
  MatchSuggestion,
  ModuleResult,
  ReconciliationSession,
  SuggestMatchesInput,
  StatementImportResult,
  TenantContext
} from "../types";
import type { BankReconciliationStore } from "../ports";

export interface CreateBankAccountInput {
  name: string;
  bankName?: string;
  currency?: string;
  openingBalanceCents?: number;
}

export interface StatementTransactionInput {
  transactionDate: string;
  description: string;
  amountCents: number;
  transactionHash: string;
  statementImportId?: string;
}

export interface ImportStatementCsvInput {
  fileName?: string;
  source?: BankStatementImportSource;
  fieldMapping: BankStatementImportFieldMapping;
  csvContent: string;
  importedById?: string;
}

export type BankReconciliationIdPrefix = "bank" | "bimp" | "btx" | "bmatch" | "recon";
export type BankReconciliationIdFactory = (prefix: BankReconciliationIdPrefix) => string;

export interface BankReconciliationServiceDeps {
  store: BankReconciliationStore;
  createId?: BankReconciliationIdFactory;
}

export interface BankReconciliationService {
  createBankAccount(ctx: TenantContext, input: CreateBankAccountInput): Promise<ModuleResult<BankAccount>>;
  listBankAccounts(ctx: TenantContext): Promise<ModuleResult<BankAccount[]>>;
  importStatementTransactions(
    ctx: TenantContext,
    bankAccountId: string,
    rows: StatementTransactionInput[]
  ): Promise<ModuleResult<StatementImportResult>>;
  importStatementCsv(
    ctx: TenantContext,
    bankAccountId: string,
    input: ImportStatementCsvInput
  ): Promise<ModuleResult<StatementImportResult>>;
  listStatementImports(ctx: TenantContext, bankAccountId?: string): Promise<ModuleResult<BankStatementImport[]>>;
  listStatementTransactions(ctx: TenantContext, bankAccountId: string): Promise<ModuleResult<BankTransaction[]>>;
  suggestMatches(ctx: TenantContext, input: SuggestMatchesInput): Promise<ModuleResult<MatchSuggestion[]>>;
  createMatch(ctx: TenantContext, input: CreateMatchInput): Promise<ModuleResult<CreateMatchResult>>;
  matchTransaction(ctx: TenantContext, transactionId: string, ledgerReferenceId: string): Promise<ModuleResult<BankTransaction>>;
  startReconciliation(
    ctx: TenantContext,
    bankAccountId: string,
    statementDate: string,
    statementBalanceCents: number
  ): Promise<ModuleResult<ReconciliationSession>>;
  listReconciliations(ctx: TenantContext, bankAccountId?: string): Promise<ModuleResult<ReconciliationSession[]>>;
  completeReconciliation(ctx: TenantContext, reconciliationId: string): Promise<ModuleResult<ReconciliationSession>>;
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

export function createSequentialBankReconciliationIdFactory(): BankReconciliationIdFactory {
  const sequences: Record<BankReconciliationIdPrefix, number> = { bank: 0, bimp: 0, btx: 0, bmatch: 0, recon: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: BankReconciliationIdPrefix): string {
  const cryptoProvider = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid = cryptoProvider?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function calculateClearedTotals(account: BankAccount, transactions: BankTransaction[]) {
  let clearedDepositsCents = 0;
  let clearedWithdrawalsCents = 0;
  for (const transaction of transactions) {
    if (transaction.amountCents >= 0) clearedDepositsCents += transaction.amountCents;
    else clearedWithdrawalsCents += Math.abs(transaction.amountCents);
  }
  return {
    clearedDepositsCents,
    clearedWithdrawalsCents,
    clearedBalanceCents: transactions.reduce((sum, tx) => sum + tx.amountCents, account.openingBalanceCents)
  };
}

interface ParsedCsvImportRows {
  rows: StatementTransactionInput[];
  skippedRows: number;
  totalRows: number;
  startDate?: string;
  endDate?: string;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dateDeltaDays(transactionDate: string, targetDate?: string | null): number | null {
  if (!targetDate) return null;
  const transactionTime = Date.parse(`${transactionDate}T00:00:00.000Z`);
  const targetTime = Date.parse(`${targetDate}T00:00:00.000Z`);
  if (!Number.isFinite(transactionTime) || !Number.isFinite(targetTime)) return null;
  return Math.round(Math.abs(transactionTime - targetTime) / 86_400_000);
}

function scoreCandidate(
  transaction: BankTransaction,
  candidate: MatchCandidate,
  input: Pick<SuggestMatchesInput, "amountToleranceCents" | "dateToleranceDays">
): MatchSuggestion | null {
  const amountToleranceCents = input.amountToleranceCents ?? 0;
  const dateTolerance = input.dateToleranceDays ?? 3;
  const amountDeltaCents = candidate.amountCents - transaction.amountCents;
  if (Math.abs(amountDeltaCents) > amountToleranceCents) return null;

  const deltaDays = dateDeltaDays(transaction.transactionDate, candidate.targetDate);
  if (deltaDays != null && deltaDays > dateTolerance) return null;

  const reasons: string[] = [];
  let confidence = 55;
  if (amountDeltaCents === 0) {
    confidence += 30;
    reasons.push("exact amount");
  } else {
    const amountPenalty = amountToleranceCents === 0 ? 30 : Math.round((Math.abs(amountDeltaCents) / amountToleranceCents) * 30);
    confidence += clamp(30 - amountPenalty, 0, 25);
    reasons.push("amount within tolerance");
  }
  if (deltaDays === 0) {
    confidence += 10;
    reasons.push("same date");
  } else if (deltaDays != null) {
    confidence += clamp(10 - deltaDays * 2, 0, 8);
    reasons.push("date within tolerance");
  }
  const normalizedDescription = transaction.description.toLowerCase();
  if (candidate.description && normalizedDescription.includes(candidate.description.toLowerCase().slice(0, 18))) {
    confidence += 5;
    reasons.push("description overlap");
  }
  if (candidate.targetRef && normalizedDescription.includes(candidate.targetRef.toLowerCase())) {
    confidence += 5;
    reasons.push("reference overlap");
  }

  return {
    ...candidate,
    amountDeltaCents,
    dateDeltaDays: deltaDays,
    confidence: clamp(confidence, 0, 100),
    reasons
  };
}

function suggestForTransaction(transaction: BankTransaction, input: SuggestMatchesInput): MatchSuggestion[] {
  const limit = clamp(input.limit ?? 10, 1, 100);
  return (input.candidates ?? [])
    .map((candidate) => scoreCandidate(transaction, candidate, input))
    .filter((candidate): candidate is MatchSuggestion => candidate !== null)
    .sort((left, right) => right.confidence - left.confidence || Math.abs(left.amountDeltaCents) - Math.abs(right.amountDeltaCents))
    .slice(0, limit);
}

function matchStatus(matchType: CreateMatchInput["matchType"]): BankTransaction["matchStatus"] {
  return matchType === "auto" || matchType === "rule" ? "auto_matched" : "manual_matched";
}

function ledgerReferenceId(input: CreateMatchInput): string | undefined {
  return input.targetType === "ledger_line" || input.targetType === "ledger_entry" ? input.targetId : undefined;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === "\"" && content[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((csvRow) => csvRow.some((value) => value.trim().length > 0));
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashDate) return null;
  const [, month, day, year] = slashDate;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseMoneyCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const compact = trimmed.replace(/[$,\s]/g, "");
  const negative = compact.startsWith("-") || (compact.startsWith("(") && compact.endsWith(")"));
  const unsigned = compact.replace(/[()]/g, "").replace(/^[+-]/, "");
  const amount = Number(unsigned);
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return negative ? -cents : cents;
}

function fieldValue(valuesByHeader: Map<string, string>, header: string | undefined): string {
  if (!header) return "";
  return valuesByHeader.get(normalizeHeader(header)) ?? "";
}

function mapCsvRows(csvContent: string, mapping: BankStatementImportFieldMapping): ModuleResult<ParsedCsvImportRows> {
  if (!mapping.amount && (!mapping.debit || !mapping.credit)) {
    return fail("field_mapping_amount_required", "CSV mapping must include amount or both debit and credit fields.");
  }

  const csvRows = parseCsv(csvContent);
  if (csvRows.length < 2) return fail("csv_empty", "CSV content must include a header row and at least one transaction row.");

  const headers = csvRows[0].map((header) => header.trim());
  const headerSet = new Set(headers.map(normalizeHeader));
  const requiredHeaders = [mapping.date, mapping.description, mapping.amount, mapping.debit, mapping.credit].filter(
    (header): header is string => Boolean(header)
  );
  const missingHeader = requiredHeaders.find((header) => !headerSet.has(normalizeHeader(header)));
  if (missingHeader) return fail("field_mapping_missing_header", `CSV header is missing mapped field: ${missingHeader}.`);

  const rows: StatementTransactionInput[] = [];
  let skippedRows = 0;
  let startDate: string | undefined;
  let endDate: string | undefined;

  for (const csvRow of csvRows.slice(1)) {
    const valuesByHeader = new Map<string, string>();
    headers.forEach((header, index) => valuesByHeader.set(normalizeHeader(header), csvRow[index]?.trim() ?? ""));

    const transactionDate = parseDate(fieldValue(valuesByHeader, mapping.date));
    const description = fieldValue(valuesByHeader, mapping.description).trim();
    let amountCents: number | null;
    if (mapping.amount) {
      amountCents = parseMoneyCents(fieldValue(valuesByHeader, mapping.amount));
    } else {
      const creditCents = parseMoneyCents(fieldValue(valuesByHeader, mapping.credit));
      const debitCents = parseMoneyCents(fieldValue(valuesByHeader, mapping.debit));
      amountCents = creditCents == null || debitCents == null ? null : creditCents - debitCents;
    }

    if (!transactionDate || !description || amountCents == null || amountCents === 0) {
      skippedRows += 1;
      continue;
    }

    startDate = startDate && startDate < transactionDate ? startDate : transactionDate;
    endDate = endDate && endDate > transactionDate ? endDate : transactionDate;
    rows.push({
      transactionDate,
      description,
      amountCents,
      transactionHash: stableHash(`${transactionDate}|${description.toLowerCase()}|${amountCents}`)
    });
  }

  return ok({ rows, skippedRows, totalRows: csvRows.length - 1, startDate, endDate });
}

export function createBankReconciliationService(deps: BankReconciliationServiceDeps): BankReconciliationService {
  const createId = deps.createId ?? defaultId;

  async function insertStatementRows(ctx: TenantContext, bankAccountId: string, rows: StatementTransactionInput[]): Promise<StatementImportResult> {
    const imported: BankTransaction[] = [];
    let skippedDuplicateCount = 0;
    for (const row of rows) {
      const transaction: BankTransaction = {
        id: createId("btx"),
        tenantId: ctx.tenantId,
        bankAccountId,
        statementImportId: row.statementImportId,
        transactionDate: row.transactionDate,
        description: row.description,
        amountCents: row.amountCents,
        transactionHash: row.transactionHash,
        matchStatus: "unmatched",
        reconciled: false,
        createdAt: now(ctx)
      };
      const inserted = await deps.store.insertTransaction(transaction);
      if (!inserted) {
        skippedDuplicateCount += 1;
        continue;
      }
      imported.push(transaction);
    }

    return { imported, importedCount: imported.length, skippedDuplicateCount };
  }

  async function createStoreMatch(ctx: TenantContext, input: CreateMatchInput): Promise<ModuleResult<CreateMatchResult>> {
    const transaction = await deps.store.getTransaction(ctx.tenantId, input.transactionId);
    if (!transaction) return fail("transaction_not_found", "Bank transaction not found.");
    if (transaction.reconciled) return fail("transaction_reconciled", "Reconciled transactions cannot be rematched.");

    const createdAt = now(ctx);
    const type = input.matchType ?? "manual";
    const match: BankTransactionMatch = {
      id: createId("bmatch"),
      tenantId: ctx.tenantId,
      bankTransactionId: transaction.id,
      targetType: input.targetType,
      targetId: input.targetId,
      targetRef: input.targetRef ?? null,
      targetDate: input.targetDate ?? null,
      targetAmountCents: input.targetAmountCents,
      description: input.description ?? null,
      matchType: type,
      confidence: input.confidence ?? null,
      amountMatchedCents: transaction.amountCents,
      confirmed: true,
      confirmedAt: createdAt,
      confirmedById: ctx.actorId ?? null,
      reconciliationId: input.reconciliationId ?? null,
      createdAt
    };
    const updated: BankTransaction = {
      ...transaction,
      ledgerReferenceId: ledgerReferenceId(input),
      matchStatus: matchStatus(type)
    };

    await deps.store.upsertMatch(match);
    await deps.store.updateTransaction(updated);
    return ok({ transaction: updated, match });
  }

  return {
    async createBankAccount(ctx, input) {
      const createdAt = now(ctx);
      const account: BankAccount = {
        id: createId("bank"),
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
      await deps.store.insertBankAccount(account);
      return ok(account);
    },

    async listBankAccounts(ctx) {
      return ok(await deps.store.listBankAccounts(ctx.tenantId));
    },

    async importStatementTransactions(ctx, bankAccountId, rows) {
      const account = await deps.store.getBankAccount(ctx.tenantId, bankAccountId);
      if (!account) return fail("bank_account_not_found", "Bank account not found.");

      return ok(await insertStatementRows(ctx, bankAccountId, rows));
    },

    async importStatementCsv(ctx, bankAccountId, input) {
      const account = await deps.store.getBankAccount(ctx.tenantId, bankAccountId);
      if (!account) return fail("bank_account_not_found", "Bank account not found.");

      const createdAt = now(ctx);
      const statementImport: BankStatementImport = {
        id: createId("bimp"),
        tenantId: ctx.tenantId,
        bankAccountId,
        source: input.source ?? "csv",
        fileName: input.fileName,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
        fieldMapping: input.fieldMapping,
        status: "processing",
        importedById: input.importedById ?? ctx.actorId,
        createdAt
      };
      await deps.store.insertStatementImport(statementImport);

      const parsed = mapCsvRows(input.csvContent, input.fieldMapping);
      if (!parsed.ok || !parsed.data) {
        const failedImport: BankStatementImport = {
          ...statementImport,
          status: "failed",
          errorMessage: parsed.error?.message ?? "CSV import failed.",
          importedAt: now(ctx)
        };
        await deps.store.updateStatementImport(failedImport);
        return fail(parsed.error?.code ?? "csv_import_failed", parsed.error?.message ?? "CSV import failed.");
      }

      const rows = parsed.data.rows.map((row) => ({ ...row, statementImportId: statementImport.id }));
      const result = await insertStatementRows(ctx, bankAccountId, rows);
      const completedImport: BankStatementImport = {
        ...statementImport,
        totalRows: parsed.data.totalRows,
        importedRows: result.importedCount,
        skippedRows: parsed.data.skippedRows,
        duplicateRows: result.skippedDuplicateCount,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: "completed",
        importedAt: now(ctx)
      };
      await deps.store.updateStatementImport(completedImport);
      return ok({ ...result, statementImport: completedImport });
    },

    async listStatementImports(ctx, bankAccountId) {
      return ok(await deps.store.listStatementImports(ctx.tenantId, bankAccountId));
    },

    async listStatementTransactions(ctx, bankAccountId) {
      return ok(await deps.store.listStatementTransactions(ctx.tenantId, bankAccountId));
    },

    async suggestMatches(ctx, input) {
      const transaction = await deps.store.getTransaction(ctx.tenantId, input.transactionId);
      if (!transaction) return fail("transaction_not_found", "Bank transaction not found.");
      if (transaction.reconciled) return fail("transaction_reconciled", "Reconciled transactions cannot be rematched.");
      return ok(suggestForTransaction(transaction, input));
    },

    async createMatch(ctx, input) {
      return createStoreMatch(ctx, input);
    },

    async matchTransaction(ctx, transactionId, ledgerReferenceId) {
      const transaction = await deps.store.getTransaction(ctx.tenantId, transactionId);
      if (!transaction) return fail("transaction_not_found", "Bank transaction not found.");
      const matched = await createStoreMatch(ctx, {
        transactionId,
        targetType: "ledger_line",
        targetId: ledgerReferenceId,
        targetRef: ledgerReferenceId,
        targetAmountCents: transaction.amountCents,
        description: "Manual ledger reference",
        matchType: "manual",
        confidence: 100
      });
      return matched.ok && matched.data ? ok(matched.data.transaction) : fail(matched.error?.code ?? "match_failed", matched.error?.message ?? "Could not match transaction.");
    },

    async startReconciliation(ctx, bankAccountId, statementDate, statementBalanceCents) {
      const account = await deps.store.getBankAccount(ctx.tenantId, bankAccountId);
      if (!account) return fail("bank_account_not_found", "Bank account not found.");
      const createdAt = now(ctx);
      const reconciliation: ReconciliationSession = {
        id: createId("recon"),
        tenantId: ctx.tenantId,
        bankAccountId,
        periodStart: statementDate,
        periodEnd: statementDate,
        openingBalanceCents: account.openingBalanceCents,
        statementDate,
        statementBalanceCents,
        clearedDepositsCents: 0,
        clearedWithdrawalsCents: 0,
        clearedBalanceCents: account.openingBalanceCents,
        differenceCents: statementBalanceCents - account.openingBalanceCents,
        transactionsCleared: 0,
        transactionsUnmatched: 0,
        status: "in_progress",
        createdAt,
        updatedAt: createdAt
      };
      await deps.store.insertReconciliation(reconciliation);
      return ok(reconciliation);
    },

    async listReconciliations(ctx, bankAccountId) {
      return ok(await deps.store.listReconciliations(ctx.tenantId, bankAccountId));
    },

    async completeReconciliation(ctx, reconciliationId) {
      const reconciliation = await deps.store.getReconciliation(ctx.tenantId, reconciliationId);
      if (!reconciliation) return fail("reconciliation_not_found", "Reconciliation not found.");
      const account = await deps.store.getBankAccount(ctx.tenantId, reconciliation.bankAccountId);
      if (!account) return fail("bank_account_not_found", "Bank account not found.");
      const scopedTransactions = await deps.store.listTransactionsForReconciliation(
        ctx.tenantId,
        reconciliation.bankAccountId,
        reconciliation.statementDate
      );
      const unmatched = scopedTransactions.filter((tx) => tx.matchStatus === "unmatched");
      if (unmatched.length > 0) return fail("unmatched_transactions", "Cannot complete reconciliation while unmatched transactions remain.");

      const clearedTotals = calculateClearedTotals(account, scopedTransactions);
      if (clearedTotals.clearedBalanceCents !== reconciliation.statementBalanceCents) {
        return fail("balance_mismatch", "Cleared balance must match statement balance.");
      }

      const completedAt = now(ctx);
      await deps.store.updateTransactions(
        scopedTransactions.map((tx) => ({
          ...tx,
          reconciled: true,
          reconciledAt: completedAt,
          reconciliationId: reconciliation.id
        }))
      );

      const completed: ReconciliationSession = {
        ...reconciliation,
        ...clearedTotals,
        differenceCents: 0,
        transactionsCleared: scopedTransactions.length,
        transactionsUnmatched: 0,
        status: "completed",
        completedAt,
        updatedAt: completedAt
      };
      await deps.store.updateReconciliation(completed);
      return ok(completed);
    }
  };
}

export function createBankReconciliationMemoryService() {
  const accounts = new Map<string, BankAccount>();
  const statementImports = new Map<string, BankStatementImport>();
  const transactions = new Map<string, BankTransaction>();
  const matches = new Map<string, BankTransactionMatch>();
  const transactionHashes = new Set<string>();
  const reconciliations = new Map<string, ReconciliationSession>();
  let accountSequence = 0;
  let statementImportSequence = 0;
  let transactionSequence = 0;
  let matchSequence = 0;
  let reconciliationSequence = 0;

  function importMemoryStatementRows(
    ctx: TenantContext,
    bankAccountId: string,
    rows: StatementTransactionInput[]
  ): ModuleResult<StatementImportResult> {
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
        statementImportId: row.statementImportId,
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
  }

  function createMemoryMatch(ctx: TenantContext, input: CreateMatchInput): ModuleResult<CreateMatchResult> {
    const transaction = transactions.get(input.transactionId);
    if (!transaction || transaction.tenantId !== ctx.tenantId) return fail("transaction_not_found", "Bank transaction not found.");
    if (transaction.reconciled) return fail("transaction_reconciled", "Reconciled transactions cannot be rematched.");

    const createdAt = now(ctx);
    const type = input.matchType ?? "manual";
    const existing = [...matches.values()].find(
      (candidate) =>
        candidate.tenantId === ctx.tenantId &&
        candidate.bankTransactionId === transaction.id &&
        candidate.targetType === input.targetType &&
        candidate.targetId === input.targetId
    );
    if (existing) matches.delete(existing.id);

    const match: BankTransactionMatch = {
      id: id("bmatch", ++matchSequence),
      tenantId: ctx.tenantId,
      bankTransactionId: transaction.id,
      targetType: input.targetType,
      targetId: input.targetId,
      targetRef: input.targetRef ?? null,
      targetDate: input.targetDate ?? null,
      targetAmountCents: input.targetAmountCents,
      description: input.description ?? null,
      matchType: type,
      confidence: input.confidence ?? null,
      amountMatchedCents: transaction.amountCents,
      confirmed: true,
      confirmedAt: createdAt,
      confirmedById: ctx.actorId ?? null,
      reconciliationId: input.reconciliationId ?? null,
      createdAt
    };
    const updated: BankTransaction = {
      ...transaction,
      ledgerReferenceId: ledgerReferenceId(input),
      matchStatus: matchStatus(type)
    };
    matches.set(match.id, match);
    transactions.set(updated.id, updated);
    return ok({ transaction: updated, match });
  }

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
      return importMemoryStatementRows(ctx, bankAccountId, rows);
    },

    importStatementCsv(ctx: TenantContext, bankAccountId: string, input: ImportStatementCsvInput): ModuleResult<StatementImportResult> {
      const account = accounts.get(bankAccountId);
      if (!account || account.tenantId !== ctx.tenantId) return fail("bank_account_not_found", "Bank account not found.");

      const createdAt = now(ctx);
      const statementImport: BankStatementImport = {
        id: id("bimp", ++statementImportSequence),
        tenantId: ctx.tenantId,
        bankAccountId,
        source: input.source ?? "csv",
        fileName: input.fileName,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
        fieldMapping: input.fieldMapping,
        status: "processing",
        importedById: input.importedById ?? ctx.actorId,
        createdAt
      };
      statementImports.set(statementImport.id, statementImport);

      const parsed = mapCsvRows(input.csvContent, input.fieldMapping);
      if (!parsed.ok || !parsed.data) {
        const failedImport: BankStatementImport = {
          ...statementImport,
          status: "failed",
          errorMessage: parsed.error?.message ?? "CSV import failed.",
          importedAt: now(ctx)
        };
        statementImports.set(failedImport.id, failedImport);
        return fail(parsed.error?.code ?? "csv_import_failed", parsed.error?.message ?? "CSV import failed.");
      }

      const imported = importMemoryStatementRows(
        ctx,
        bankAccountId,
        parsed.data.rows.map((row) => ({ ...row, statementImportId: statementImport.id }))
      );
      const completedImport: BankStatementImport = {
        ...statementImport,
        totalRows: parsed.data.totalRows,
        importedRows: imported.data?.importedCount ?? 0,
        skippedRows: parsed.data.skippedRows,
        duplicateRows: imported.data?.skippedDuplicateCount ?? 0,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: "completed",
        importedAt: now(ctx)
      };
      statementImports.set(completedImport.id, completedImport);
      return ok({ ...(imported.data ?? { imported: [], importedCount: 0, skippedDuplicateCount: 0 }), statementImport: completedImport });
    },

    listStatementImports(ctx: TenantContext, bankAccountId?: string): ModuleResult<BankStatementImport[]> {
      return ok(
        [...statementImports.values()]
          .filter(
            (statementImport) =>
              statementImport.tenantId === ctx.tenantId && (!bankAccountId || statementImport.bankAccountId === bankAccountId)
          )
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      );
    },

    listStatementTransactions(ctx: TenantContext, bankAccountId: string): ModuleResult<BankTransaction[]> {
      return ok([...transactions.values()].filter((tx) => tx.tenantId === ctx.tenantId && tx.bankAccountId === bankAccountId));
    },

    suggestMatches(ctx: TenantContext, input: SuggestMatchesInput): ModuleResult<MatchSuggestion[]> {
      const transaction = transactions.get(input.transactionId);
      if (!transaction || transaction.tenantId !== ctx.tenantId) return fail("transaction_not_found", "Bank transaction not found.");
      if (transaction.reconciled) return fail("transaction_reconciled", "Reconciled transactions cannot be rematched.");
      return ok(suggestForTransaction(transaction, input));
    },

    createMatch(ctx: TenantContext, input: CreateMatchInput): ModuleResult<CreateMatchResult> {
      return createMemoryMatch(ctx, input);
    },

    matchTransaction(ctx: TenantContext, transactionId: string, ledgerReferenceId: string): ModuleResult<BankTransaction> {
      const transaction = transactions.get(transactionId);
      if (!transaction || transaction.tenantId !== ctx.tenantId) return fail("transaction_not_found", "Bank transaction not found.");
      const matched = createMemoryMatch(ctx, {
        transactionId,
        targetType: "ledger_line",
        targetId: ledgerReferenceId,
        targetRef: ledgerReferenceId,
        targetAmountCents: transaction.amountCents,
        description: "Manual ledger reference",
        matchType: "manual",
        confidence: 100
      });
      return matched.ok && matched.data ? ok(matched.data.transaction) : fail(matched.error?.code ?? "match_failed", matched.error?.message ?? "Could not match transaction.");
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

    listReconciliations(ctx: TenantContext, bankAccountId?: string): ModuleResult<ReconciliationSession[]> {
      return ok(
        [...reconciliations.values()]
          .filter((session) => session.tenantId === ctx.tenantId && (!bankAccountId || session.bankAccountId === bankAccountId))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      );
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
