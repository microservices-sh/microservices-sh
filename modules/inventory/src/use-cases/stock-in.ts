import { stockInInputSchema } from "../schemas";
import { createMovement, err, findExistingMovement, hooks, movementResult, ok, recordMovement, validateProduct, type InventoryDeps } from "./shared";

export async function stockIn(input: unknown, deps: InventoryDeps) {
  const filtered = await hooks(deps).beforeStockIn(input);
  const parsed = stockInInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_STOCK_IN_INPUT", "Stock-in input is invalid.", parsed.error.issues);
  }

  const existing = await findExistingMovement(deps, parsed.data, "stock_in");
  if (existing) return ok(200, await movementResult(deps, existing, true));

  const productError = await validateProduct(deps, parsed.data.tenantId, parsed.data.productId);
  if (productError) return productError;

  const movement = createMovement({
    tenantId: parsed.data.tenantId,
    productId: parsed.data.productId,
    locationId: parsed.data.locationId,
    movementType: "stock_in",
    quantity: parsed.data.quantity,
    onHandDelta: parsed.data.quantity,
    reservedDelta: 0,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId,
    reason: parsed.data.reason,
    actorId: deps.actor?.id ?? null,
    now: deps.now
  });

  const result = await recordMovement(deps, movement);
  return ok(result.idempotent ? 200 : 201, result);
}
