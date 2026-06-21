import { reconcileStockInputSchema } from "../schemas";
import { createMovement, err, findExistingMovement, hooks, movementResult, ok, recordMovement, validateProduct, type InventoryDeps } from "./shared";

export async function reconcileStock(input: unknown, deps: InventoryDeps) {
  const filtered = await hooks(deps).beforeReconciliation(input);
  const parsed = reconcileStockInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_RECONCILIATION_INPUT", "Reconciliation input is invalid.", parsed.error.issues);
  }

  const existing = await findExistingMovement(deps, parsed.data, "adjustment");
  if (existing) return ok(200, await movementResult(deps, existing, true));

  const productError = await validateProduct(deps, parsed.data.tenantId, parsed.data.productId);
  if (productError) return productError;

  const current = await deps.inventoryStore.getBalance(
    parsed.data.tenantId,
    parsed.data.productId,
    parsed.data.locationId
  );
  const onHandDelta = parsed.data.countedQuantity - current.onHand;

  const movement = createMovement({
    tenantId: parsed.data.tenantId,
    productId: parsed.data.productId,
    locationId: parsed.data.locationId,
    movementType: "adjustment",
    quantity: Math.abs(onHandDelta),
    onHandDelta,
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
