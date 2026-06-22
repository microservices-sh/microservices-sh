import { completeReconciliationDocumentInputSchema } from "../schemas";
import type { InventoryReconciliationLine } from "../types";
import { reconcileStock } from "./reconcile-stock";
import { err, ok, type InventoryDeps } from "./shared";
import { isoNow } from "../service";

export async function completeReconciliationDocument(input: unknown, deps: InventoryDeps) {
  const parsed = completeReconciliationDocumentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "inventory.INVALID_RECONCILIATION_COMPLETION_INPUT",
      "Reconciliation completion input is invalid.",
      parsed.error.issues
    );
  }

  const document = await deps.inventoryStore.getReconciliationDocument(parsed.data.tenantId, parsed.data.documentId);
  if (!document) {
    return err(404, "inventory.RECONCILIATION_DOCUMENT_NOT_FOUND", "Reconciliation document was not found.");
  }
  if (document.status === "completed") {
    return ok(200, { document, idempotent: true });
  }

  const completedAt = isoNow(deps.now);
  const completedLines: Array<{ lineId: string; status: "matched" | "adjusted"; movementId: string | null }> = [];

  for (const line of document.lines) {
    const completion = await completeLine(line, document.reason, deps);
    if (!completion.ok) return completion;
    completedLines.push(completion.data);
  }

  await deps.inventoryStore.markReconciliationDocumentCompleted(
    document.tenantId,
    document.id,
    completedAt,
    deps.actor?.id ?? null,
    completedLines
  );
  await deps.inventoryStore.writeEvent({
    eventName: "inventory.reconciliation_document_completed",
    entityType: "reconciliation_document",
    entityId: document.id,
    tenantId: document.tenantId,
    payload: {
      lineCount: document.lines.length,
      adjustedLineCount: completedLines.filter((line) => line.status === "adjusted").length
    }
  });

  const updated = await deps.inventoryStore.getReconciliationDocument(document.tenantId, document.id);
  return ok(200, { document: updated ?? document, idempotent: false });
}

async function completeLine(line: InventoryReconciliationLine, reason: string | null, deps: InventoryDeps) {
  const current = await deps.inventoryStore.getBalance(line.tenantId, line.productId, line.locationId);
  if (current.onHand === line.countedQuantity) {
    return ok(200, { lineId: line.id, status: "matched" as const, movementId: null });
  }

  const result = await reconcileStock(
    {
      tenantId: line.tenantId,
      productId: line.productId,
      locationId: line.locationId,
      countedQuantity: line.countedQuantity,
      sourceType: "reconciliation-document-line",
      sourceId: line.id,
      reason: reason ?? `Inventory reconciliation ${line.documentId}`
    },
    deps
  );
  if (!result.ok) return result;

  return ok(200, {
    lineId: line.id,
    status: "adjusted" as const,
    movementId: result.data.movement.id
  });
}
