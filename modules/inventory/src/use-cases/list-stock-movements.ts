import { stockMovementFilterSchema } from "../schemas";
import { err, ok, type InventoryDeps } from "./shared";

export async function listStockMovements(input: unknown, deps: InventoryDeps) {
  const parsed = stockMovementFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_MOVEMENT_FILTER", "Movement filter is invalid.", parsed.error.issues);
  }

  const movements = await deps.inventoryStore.listMovements(parsed.data);
  return ok(200, { movements });
}
