import { createReconciliationDocumentInputSchema } from "../schemas";
import { inventoryId, isoNow, normalizeOptional } from "../service";
import type { InventoryReconciliationDocument, InventoryReconciliationLine } from "../types";
import { err, ok, validateProduct, type InventoryDeps } from "./shared";

export async function createReconciliationDocument(input: unknown, deps: InventoryDeps) {
  const parsed = createReconciliationDocumentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "inventory.INVALID_RECONCILIATION_DOCUMENT_INPUT",
      "Reconciliation document input is invalid.",
      parsed.error.issues
    );
  }

  const seen = new Set<string>();
  const now = isoNow(deps.now);
  const documentId = inventoryId("inv_rec");
  const lines: InventoryReconciliationLine[] = [];

  for (const line of parsed.data.lines) {
    const locationId = line.locationId ?? parsed.data.locationId;
    const key = `${line.productId}\u0000${locationId}`;
    if (seen.has(key)) {
      return err(
        400,
        "inventory.DUPLICATE_RECONCILIATION_LINE",
        "Each product/location pair can appear only once in a reconciliation document."
      );
    }
    seen.add(key);

    const productError = await validateProduct(deps, parsed.data.tenantId, line.productId);
    if (productError) return productError;

    const balance = await deps.inventoryStore.getBalance(parsed.data.tenantId, line.productId, locationId);
    const differenceQuantity = line.countedQuantity - balance.onHand;
    lines.push({
      id: inventoryId("inv_rec_line"),
      documentId,
      tenantId: parsed.data.tenantId,
      productId: line.productId,
      locationId,
      expectedQuantity: balance.onHand,
      countedQuantity: line.countedQuantity,
      differenceQuantity,
      status: "pending",
      movementId: null,
      createdAt: now,
      updatedAt: now
    });
  }

  const document: InventoryReconciliationDocument = {
    id: documentId,
    tenantId: parsed.data.tenantId,
    locationId: parsed.data.locationId,
    reference: normalizeOptional(parsed.data.reference),
    reason: normalizeOptional(parsed.data.reason),
    status: "draft",
    createdById: deps.actor?.id ?? null,
    completedById: null,
    createdAt: now,
    completedAt: null
  };

  await deps.inventoryStore.insertReconciliationDocument(document, lines);
  await deps.inventoryStore.writeEvent({
    eventName: "inventory.reconciliation_document_created",
    entityType: "reconciliation_document",
    entityId: document.id,
    tenantId: document.tenantId,
    payload: {
      reference: document.reference,
      lineCount: lines.length
    }
  });

  return ok(201, { document: { ...document, lines } });
}
