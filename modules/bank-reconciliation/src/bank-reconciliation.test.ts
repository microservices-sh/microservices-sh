import { describe, expect, it } from "vitest";
import { createMemoryBankReconciliationStore } from "./adapters/memory-bank-reconciliation-store";
import {
  createBankReconciliationMemoryService,
  createBankReconciliationService,
  createSequentialBankReconciliationIdFactory
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
    const blocked = service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("unmatched_transactions");

    const tx = imported.data!.imported[0];
    expect(service.matchTransaction(ctx, tx.id, "journal_line_1").ok).toBe(true);

    const completed = service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(completed.ok).toBe(true);
    expect(completed.data!.status).toBe("completed");
    expect(service.listStatementTransactions(ctx, account.data!.id).data![0].reconciled).toBe(true);
  });

  it("runs the reconciliation workflow through the async store-backed service", async () => {
    const service = createBankReconciliationService({
      store: createMemoryBankReconciliationStore(),
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
    const blocked = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("unmatched_transactions");

    const tx = imported.data!.imported[0];
    expect((await service.matchTransaction(ctx, tx.id, "journal_line_1")).ok).toBe(true);

    const completed = await service.completeReconciliation(ctx, reconciliation.data!.id);
    expect(completed.ok).toBe(true);
    expect(completed.data!.status).toBe("completed");
    expect(completed.data!.clearedDepositsCents).toBe(500);
    expect(completed.data!.clearedBalanceCents).toBe(1500);

    const transactions = await service.listStatementTransactions(ctx, account.data!.id);
    expect(transactions.data![0].reconciled).toBe(true);
    expect(transactions.data![0].reconciliationId).toBe(reconciliation.data!.id);
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
});
