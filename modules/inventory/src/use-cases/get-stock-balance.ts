import { stockBalanceLookupSchema } from "../schemas";
import { err, ok, validateProduct, type InventoryDeps } from "./shared";

export async function getStockBalance(input: unknown, deps: InventoryDeps) {
  const parsed = stockBalanceLookupSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_BALANCE_INPUT", "Balance lookup input is invalid.", parsed.error.issues);
  }

  const productError = await validateProduct(deps, parsed.data.tenantId, parsed.data.productId);
  if (productError) return productError;

  const balance = await deps.inventoryStore.getBalance(
    parsed.data.tenantId,
    parsed.data.productId,
    parsed.data.locationId
  );
  return ok(200, { balance });
}
