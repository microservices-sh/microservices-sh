import { describe, expect, it } from "vitest";
import { createBankReconciliationMemoryService } from "./service";

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
});
