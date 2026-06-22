import { describe, expect, it } from "vitest";
import { createMemoryBankReconciliationStore } from "./adapters/memory-bank-reconciliation-store";
import {
  bankStatementImportMappingPresets,
  createBankReconciliationMemoryService,
  createBankReconciliationService,
  createSequentialBankReconciliationIdFactory,
  detectStatementImportFieldMapping,
  resolveStatementImportFieldMapping
} from "./service";

const ctx = { tenantId: "tenant_1", now: "2026-06-21T00:00:00.000Z" };

describe("bank-reconciliation", () => {
  it("imports statement transactions idempotently and blocks reconciliation until matched and balanced", () => {
    const service = createBankReconciliationMemoryService();
    const account = service.createBankAccount(ctx, { name: "Operating", openingBalanceCents: 1000 });
    expect(account.ok).toBe(true);

    const imported = service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Deposit", amountCents: 500, transactionHash: "hash-1" },
      { transactionDate: "2026-06-20", description: "Duplicate", amountCents: 500, transactionHash: "hash-1" }
    ]);
    expect(imported.data!.importedCount).toBe(1);
    expect(imported.data!.skippedDuplicateCount).toBe(1);

    const reconciliation = service.startReconciliation(ctx, account.data!.id, "2026-06-21", 1500);
    expect(service.listReconciliations(ctx, account.data!.id).data?.map((session) => session.id)).toEqual([reconciliation.data!.id]);
    const blocked = service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("unmatched_transactions");

    const tx = imported.data!.imported[0];
    expect(service.matchTransaction(ctx, tx.id, "journal_line_1").ok).toBe(true);
    expect(service.clearReconciliationTransaction(ctx, { reconciliationId: reconciliation.data!.id, transactionId: tx.id }).ok).toBe(true);

    const completed = service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(completed.ok).toBe(true);
    expect(completed.data!.status).toBe("completed");
    expect(service.listStatementTransactions(ctx, account.data!.id).data![0].reconciled).toBe(true);
  });

  it("runs the reconciliation workflow through the async store-backed service", async () => {
    const store = createMemoryBankReconciliationStore();
    const service = createBankReconciliationService({
      store,
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating", openingBalanceCents: 1000 });
    expect(account.ok).toBe(true);

    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Deposit", amountCents: 500, transactionHash: "hash-1" },
      { transactionDate: "2026-06-20", description: "Duplicate", amountCents: 500, transactionHash: "hash-1" }
    ]);
    expect(imported.data!.importedCount).toBe(1);
    expect(imported.data!.skippedDuplicateCount).toBe(1);

    const reconciliation = await service.startReconciliation(ctx, account.data!.id, "2026-06-21", 1500);
    const listedBeforeCompletion = await service.listReconciliations(ctx, account.data!.id);
    expect(listedBeforeCompletion.data).toMatchObject([{ id: reconciliation.data!.id, status: "in_progress" }]);

    const blocked = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("unmatched_transactions");

    const tx = imported.data!.imported[0];
    expect((await service.matchTransaction(ctx, tx.id, "journal_line_1")).ok).toBe(true);
    const cleared = await service.clearReconciliationTransaction(
      { ...ctx, actorId: "user_1" },
      { reconciliationId: reconciliation.data!.id, transactionId: tx.id }
    );
    expect(cleared.ok).toBe(true);
    expect(cleared.data).toMatchObject({
      transaction: { id: tx.id, cleared: true, clearedById: "user_1", clearedReconciliationId: reconciliation.data!.id },
      reconciliation: { transactionsCleared: 1, clearedBalanceCents: 1500, differenceCents: 0 }
    });

    const completed = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(completed.ok).toBe(true);
    expect(completed.data!.status).toBe("completed");
    expect(completed.data!.clearedDepositsCents).toBe(500);
    expect(completed.data!.clearedBalanceCents).toBe(1500);

    const listedAfterCompletion = await service.listReconciliations(ctx);
    expect(listedAfterCompletion.data).toMatchObject([{ id: reconciliation.data!.id, status: "completed", transactionsCleared: 1 }]);

    const transactions = await service.listStatementTransactions(ctx, account.data!.id);
    expect(transactions.data![0].reconciled).toBe(true);
    expect(transactions.data![0].reconciliationId).toBe(reconciliation.data!.id);

    const matches = await store.listMatchesForTransaction(ctx.tenantId, tx.id);
    expect(matches).toMatchObject([{ targetType: "ledger_line", targetId: "journal_line_1", amountMatchedCents: 500 }]);
  });

  it("suggests candidate matches and creates explicit match records", async () => {
    const store = createMemoryBankReconciliationStore();
    const service = createBankReconciliationService({
      store,
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Stripe payout", amountCents: 84_000, transactionHash: "hash-suggest-1" }
    ]);
    const tx = imported.data!.imported[0];

    const suggestions = await service.suggestMatches(ctx, {
      transactionId: tx.id,
      amountToleranceCents: 500,
      dateToleranceDays: 2,
      candidates: [
        {
          targetType: "ledger_line",
          targetId: "jel_1",
          targetRef: "JE-1",
          targetDate: "2026-06-20",
          amountCents: 84_000,
          description: "Stripe payout",
          source: "accounting-core"
        },
        {
          targetType: "payment",
          targetId: "pay_1",
          targetDate: "2026-06-12",
          amountCents: 84_000,
          description: "Old payment",
          source: "payment"
        }
      ]
    });
    expect(suggestions.ok).toBe(true);
    expect(suggestions.data).toHaveLength(1);
    expect(suggestions.data![0]).toMatchObject({ targetId: "jel_1", confidence: 100 });

    const matched = await service.createMatch(ctx, {
      transactionId: tx.id,
      targetType: "ledger_line",
      targetId: suggestions.data![0].targetId,
      targetRef: suggestions.data![0].targetRef,
      targetDate: suggestions.data![0].targetDate,
      targetAmountCents: suggestions.data![0].amountCents,
      description: suggestions.data![0].description,
      matchType: "manual",
      confidence: suggestions.data![0].confidence
    });
    expect(matched.ok).toBe(true);
    expect(matched.data!.transaction).toMatchObject({ id: tx.id, matchStatus: "manual_matched", ledgerReferenceId: "jel_1" });
    await expect(store.listMatchesForTransaction(ctx.tenantId, tx.id)).resolves.toMatchObject([
      { targetType: "ledger_line", targetId: "jel_1", confidence: 100, confirmed: true }
    ]);
  });

  it("unmatches and excludes transactions without changing reconciled rows", async () => {
    const store = createMemoryBankReconciliationStore();
    const service = createBankReconciliationService({
      store,
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Stripe payout", amountCents: 500, transactionHash: "hash-correct-1" },
      { transactionDate: "2026-06-20", description: "Bank fee", amountCents: -25, transactionHash: "hash-correct-2" }
    ]);
    const [payout, fee] = imported.data!.imported;

    const matched = await service.matchTransaction(ctx, payout.id, "journal_line_1");
    expect(matched.ok).toBe(true);
    await expect(store.listMatchesForTransaction(ctx.tenantId, payout.id)).resolves.toHaveLength(1);

    const unmatched = await service.unmatchTransaction(ctx, { transactionId: payout.id });
    expect(unmatched.ok).toBe(true);
    expect(unmatched.data).toMatchObject({ removedMatchCount: 1, transaction: { matchStatus: "unmatched" } });
    expect(unmatched.data!.transaction.ledgerReferenceId).toBeUndefined();
    await expect(store.listMatchesForTransaction(ctx.tenantId, payout.id)).resolves.toHaveLength(0);

    await service.matchTransaction(ctx, fee.id, "fee_line_1");
    const excluded = await service.excludeTransaction(ctx, { transactionId: fee.id, reason: "Bank fee below threshold" });
    expect(excluded.ok).toBe(true);
    expect(excluded.data).toMatchObject({ removedMatchCount: 1, transaction: { matchStatus: "excluded" } });
    await expect(store.listMatchesForTransaction(ctx.tenantId, fee.id)).resolves.toHaveLength(0);

    const restored = await service.restoreExcludedTransaction(ctx, { transactionId: fee.id });
    expect(restored.ok).toBe(true);
    expect(restored.data).toMatchObject({ transaction: { matchStatus: "unmatched" } });
  });

  it("ignores excluded transactions when completing reconciliation", async () => {
    const store = createMemoryBankReconciliationStore();
    const service = createBankReconciliationService({
      store,
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating", openingBalanceCents: 1_000 });
    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Deposit", amountCents: 500, transactionHash: "hash-exclude-1" },
      { transactionDate: "2026-06-20", description: "Ignored fee", amountCents: -25, transactionHash: "hash-exclude-2" }
    ]);
    const [deposit, fee] = imported.data!.imported;
    await service.matchTransaction(ctx, deposit.id, "journal_line_1");
    await service.excludeTransaction(ctx, { transactionId: fee.id, reason: "Not in this statement balance" });

    const reconciliation = await service.startReconciliation(ctx, account.data!.id, "2026-06-21", 1_500);
    await service.clearReconciliationTransaction(ctx, { reconciliationId: reconciliation.data!.id, transactionId: deposit.id });
    const completed = await service.completeReconciliation(ctx, reconciliation.data!.id);

    expect(completed.ok).toBe(true);
    expect(completed.data).toMatchObject({
      status: "completed",
      clearedDepositsCents: 500,
      clearedWithdrawalsCents: 0,
      clearedBalanceCents: 1_500,
      transactionsCleared: 1
    });
    const transactions = await service.listStatementTransactions(ctx, account.data!.id);
    expect(transactions.data!.find((tx) => tx.id === deposit.id)).toMatchObject({ reconciled: true });
    expect(transactions.data!.find((tx) => tx.id === fee.id)).toMatchObject({ matchStatus: "excluded", reconciled: false });
    expect(await service.unmatchTransaction(ctx, { transactionId: deposit.id })).toMatchObject({
      ok: false,
      error: { code: "transaction_reconciled" }
    });
  });

  it("clears and unclears transactions without finalizing them", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating", openingBalanceCents: 1_000 });
    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Deposit", amountCents: 500, transactionHash: "hash-clear-1" },
      { transactionDate: "2026-06-20", description: "Excluded fee", amountCents: -25, transactionHash: "hash-clear-2" }
    ]);
    const [deposit, fee] = imported.data!.imported;
    expect(deposit.cleared).toBe(false);
    const reconciliation = await service.startReconciliation(ctx, account.data!.id, "2026-06-21", 1_500);

    const cleared = await service.clearReconciliationTransaction(
      { ...ctx, actorId: "user_1" },
      { reconciliationId: reconciliation.data!.id, transactionId: deposit.id }
    );
    expect(cleared.ok).toBe(true);
    expect(cleared.data).toMatchObject({
      transaction: {
        id: deposit.id,
        cleared: true,
        clearedAt: ctx.now,
        clearedById: "user_1",
        clearedReconciliationId: reconciliation.data!.id,
        reconciled: false
      },
      reconciliation: {
        transactionsCleared: 1,
        clearedDepositsCents: 500,
        clearedWithdrawalsCents: 0,
        clearedBalanceCents: 1_500,
        differenceCents: 0
      }
    });
    const persisted = await service.listStatementTransactions(ctx, account.data!.id);
    expect(persisted.data!.find((tx) => tx.id === deposit.id)).toMatchObject({
      cleared: true,
      clearedReconciliationId: reconciliation.data!.id,
      reconciled: false
    });

    const uncleared = await service.unclearReconciliationTransaction(ctx, {
      reconciliationId: reconciliation.data!.id,
      transactionId: deposit.id
    });
    expect(uncleared.ok).toBe(true);
    expect(uncleared.data).toMatchObject({
      transaction: { id: deposit.id, cleared: false, reconciled: false },
      reconciliation: { transactionsCleared: 0, clearedBalanceCents: 1_000, differenceCents: 500 }
    });
    expect(uncleared.data!.transaction.clearedAt).toBeUndefined();
    expect(uncleared.data!.transaction.clearedById).toBeUndefined();

    await service.excludeTransaction(ctx, { transactionId: fee.id, reason: "Outside reconciliation" });
    await expect(
      service.clearReconciliationTransaction(ctx, { reconciliationId: reconciliation.data!.id, transactionId: fee.id })
    ).resolves.toMatchObject({ ok: false, error: { code: "transaction_excluded" } });
  });

  it("completes reconciliation using only cleared matched transactions", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating", openingBalanceCents: 1_000 });
    const imported = await service.importStatementTransactions(ctx, account.data!.id, [
      { transactionDate: "2026-06-20", description: "Deposit", amountCents: 500, transactionHash: "hash-final-clear-1" },
      { transactionDate: "2026-06-20", description: "Matched but uncleared", amountCents: -25, transactionHash: "hash-final-clear-2" }
    ]);
    const [deposit, unclearedFee] = imported.data!.imported;
    await service.matchTransaction(ctx, deposit.id, "journal_line_deposit");
    await service.matchTransaction(ctx, unclearedFee.id, "journal_line_fee");
    const reconciliation = await service.startReconciliation(ctx, account.data!.id, "2026-06-21", 1_500);

    const blocked = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("balance_mismatch");

    await service.clearReconciliationTransaction(ctx, { reconciliationId: reconciliation.data!.id, transactionId: deposit.id });
    const completed = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(completed.ok).toBe(true);
    expect(completed.data).toMatchObject({
      status: "completed",
      clearedDepositsCents: 500,
      clearedWithdrawalsCents: 0,
      clearedBalanceCents: 1_500,
      transactionsCleared: 1
    });

    const transactions = await service.listStatementTransactions(ctx, account.data!.id);
    expect(transactions.data!.find((tx) => tx.id === deposit.id)).toMatchObject({
      cleared: true,
      reconciled: true,
      reconciliationId: reconciliation.data!.id
    });
    expect(transactions.data!.find((tx) => tx.id === unclearedFee.id)).toMatchObject({
      cleared: false,
      reconciled: false
    });
    await expect(
      service.unclearReconciliationTransaction(ctx, { reconciliationId: reconciliation.data!.id, transactionId: deposit.id })
    ).resolves.toMatchObject({ ok: false, error: { code: "reconciliation_not_in_progress" } });
  });

  it("imports mapped CSV statements and records import session history", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    expect(account.ok).toBe(true);

    const csvContent = [
      "Date,Details,Debit,Credit",
      "06/20/2026,Stripe payout,,840.00",
      "2026-06-21,Cloud hosting,125.50,",
      "2026-06-22,,9.99,"
    ].join("\n");

    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "operating.csv",
      importedById: "user_1",
      fieldMapping: { date: "Date", description: "Details", debit: "Debit", credit: "Credit" },
      csvContent
    });

    expect(imported.ok).toBe(true);
    expect(imported.data!.importedCount).toBe(2);
    expect(imported.data!.skippedDuplicateCount).toBe(0);
    expect(imported.data!.statementImport).toMatchObject({
      id: "bimp_000001",
      fileName: "operating.csv",
      totalRows: 3,
      importedRows: 2,
      skippedRows: 1,
      duplicateRows: 0,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      importedById: "user_1",
      status: "completed"
    });
    expect(imported.data!.imported.map((tx) => tx.amountCents)).toEqual([84000, -12550]);
    expect(imported.data!.imported[0].statementImportId).toBe("bimp_000001");

    const duplicate = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "operating-repeat.csv",
      fieldMapping: { date: "Date", description: "Details", debit: "Debit", credit: "Credit" },
      csvContent
    });

    expect(duplicate.ok).toBe(true);
    expect(duplicate.data!.importedCount).toBe(0);
    expect(duplicate.data!.skippedDuplicateCount).toBe(2);
    expect(duplicate.data!.statementImport?.duplicateRows).toBe(2);

    const imports = await service.listStatementImports(ctx, account.data!.id);
    expect(imports.data).toHaveLength(2);
    expect(imports.data?.map((statementImport) => statementImport.fileName)).toEqual(["operating.csv", "operating-repeat.csv"]);
  });

  it("previews auto-detected CSV statements without persisting imports or transactions", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const csvContent = [
      "Trans Date,Narrative,Value",
      "06/20/2026,Stripe payout,840.00",
      "bad-date,Cloud hosting,(125.50)",
      "06/22/2026,,9.99",
      "06/23/2026,Interest,1.25"
    ].join("\n");

    const preview = await service.previewStatementImportCsv(ctx, account.data!.id, {
      autoDetectFieldMapping: true,
      csvContent,
      previewLimit: 10
    });

    expect(preview.ok).toBe(true);
    expect(preview.data).toMatchObject({
      totalRows: 4,
      importableRows: 2,
      duplicateRows: 0,
      skippedRows: 2,
      truncated: false,
      fieldMapping: { autoDetected: true, date: "Trans Date", description: "Narrative", amount: "Value" }
    });
    expect(preview.data!.rows.map((row) => row.status)).toEqual(["importable", "skipped", "skipped", "importable"]);
    expect(preview.data!.rows[1]).toMatchObject({ rowNumber: 3, errorCode: "transaction_date_invalid" });
    expect(preview.data!.rows[2]).toMatchObject({ rowNumber: 4, errorCode: "description_missing" });
    await expect(service.listStatementImports(ctx, account.data!.id)).resolves.toMatchObject({ data: [] });
    await expect(service.listStatementTransactions(ctx, account.data!.id)).resolves.toMatchObject({ data: [] });
  });

  it("previews existing and in-file CSV duplicates before import", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "existing.csv",
      fieldMappingPresetId: "standard_amount",
      csvContent: ["Date,Description,Amount", "2026-06-20,Stripe payout,840.00"].join("\n")
    });
    expect(imported.ok).toBe(true);

    const preview = await service.previewStatementImportCsv(ctx, account.data!.id, {
      fieldMappingPresetId: "standard_amount",
      csvContent: [
        "Date,Description,Amount",
        "2026-06-20,Stripe payout,840.00",
        "2026-06-21,Cloud hosting,-125.50",
        "2026-06-21,Cloud hosting,-125.50"
      ].join("\n")
    });

    expect(preview.ok).toBe(true);
    expect(preview.data).toMatchObject({ totalRows: 3, importableRows: 1, duplicateRows: 2, skippedRows: 0 });
    expect(preview.data!.rows.map((row) => row.status)).toEqual(["duplicate", "importable", "duplicate"]);
    expect(preview.data!.rows[0]).toMatchObject({
      rowNumber: 2,
      duplicateTransactionId: "btx_000001",
      errorCode: "duplicate_transaction"
    });
    expect(preview.data!.rows[2]).toMatchObject({
      rowNumber: 4,
      errorCode: "duplicate_transaction",
      errorMessage: "Duplicate of row 3."
    });
    await expect(service.listStatementImports(ctx, account.data!.id)).resolves.toMatchObject({ data: [{ id: "bimp_000001" }] });
    await expect(service.listStatementTransactions(ctx, account.data!.id)).resolves.toMatchObject({ data: [{ id: "btx_000001" }] });
  });

  it("imports CSV statements through a field mapping preset", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const presets = await service.listStatementImportFieldMappingPresets();
    expect(presets.ok).toBe(true);
    expect(presets.data?.map((preset) => preset.id)).toEqual(bankStatementImportMappingPresets.map((preset) => preset.id));

    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "standard.csv",
      fieldMappingPresetId: "standard_amount",
      csvContent: ["Date,Description,Amount", "2026-06-20,Stripe payout,840.00", "2026-06-21,Cloud hosting,-125.50"].join("\n")
    });

    expect(imported.ok).toBe(true);
    expect(imported.data!.imported.map((tx) => tx.amountCents)).toEqual([84000, -12550]);
    expect(imported.data!.statementImport?.fieldMapping).toEqual({
      presetId: "standard_amount",
      date: "Date",
      description: "Description",
      amount: "Amount"
    });
  });

  it("rejects unknown CSV mapping presets before creating an import", async () => {
    const store = createMemoryBankReconciliationStore();
    const service = createBankReconciliationService({
      store,
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });

    expect(resolveStatementImportFieldMapping({ fieldMappingPresetId: "missing" as never, csvContent: "Date,Description,Amount" })).toMatchObject({
      ok: false,
      error: { code: "field_mapping_preset_not_found" }
    });
    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "missing-preset.csv",
      fieldMappingPresetId: "missing" as never,
      csvContent: ["Date,Description,Amount", "2026-06-20,Stripe payout,840.00"].join("\n")
    });

    expect(imported.ok).toBe(false);
    expect(imported.error?.code).toBe("field_mapping_preset_not_found");
    await expect(store.listStatementImports(ctx.tenantId, account.data!.id)).resolves.toHaveLength(0);
  });

  it("auto-detects CSV field mappings for signed amount imports", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const csvContent = ["Trans Date,Narrative,Value", "06/20/2026,Stripe payout,840.00", "06/21/2026,Cloud hosting,(125.50)"].join(
      "\n"
    );

    expect(detectStatementImportFieldMapping(csvContent)).toMatchObject({
      ok: true,
      data: { autoDetected: true, date: "Trans Date", description: "Narrative", amount: "Value" }
    });

    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "auto-value.csv",
      autoDetectFieldMapping: true,
      csvContent
    });

    expect(imported.ok).toBe(true);
    expect(imported.data!.imported.map((tx) => tx.amountCents)).toEqual([84000, -12550]);
    expect(imported.data!.statementImport?.fieldMapping).toEqual({
      autoDetected: true,
      date: "Trans Date",
      description: "Narrative",
      amount: "Value"
    });
  });

  it("auto-detects debit and credit columns when no signed amount exists", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
      createId: createSequentialBankReconciliationIdFactory()
    });
    const account = await service.createBankAccount(ctx, { name: "Operating" });
    const csvContent = ["Posted Date,Transaction,Withdrawal,Deposit", "06/20/2026,Stripe payout,,840.00", "06/21/2026,Cloud hosting,125.50,"].join(
      "\n"
    );

    const imported = await service.importStatementCsv(ctx, account.data!.id, {
      fileName: "auto-debit-credit.csv",
      autoDetectFieldMapping: true,
      csvContent
    });

    expect(imported.ok).toBe(true);
    expect(imported.data!.imported.map((tx) => tx.amountCents)).toEqual([84000, -12550]);
    expect(imported.data!.statementImport?.fieldMapping).toEqual({
      autoDetected: true,
      date: "Posted Date",
      description: "Transaction",
      debit: "Withdrawal",
      credit: "Deposit"
    });
  });
});
