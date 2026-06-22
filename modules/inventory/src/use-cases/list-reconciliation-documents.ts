import { reconciliationDocumentFilterSchema } from "../schemas";
import { err, ok, type InventoryDeps } from "./shared";

export async function listReconciliationDocuments(input: unknown, deps: InventoryDeps) {
  const parsed = reconciliationDocumentFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "inventory.INVALID_RECONCILIATION_DOCUMENT_FILTER",
      "Reconciliation document filter is invalid.",
      parsed.error.issues
    );
  }

  const documents = await deps.inventoryStore.listReconciliationDocuments(parsed.data);
  return ok(200, { documents });
}
