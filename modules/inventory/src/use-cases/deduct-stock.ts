import { deductStockInputSchema } from "../schemas";
import {
  createMovement,
  err,
  findExistingMovement,
  hooks,
  insufficientAvailable,
  insufficientReserved,
  movementResult,
  ok,
  recordMovement,
  validateProduct,
  type InventoryDeps
} from "./shared";

export async function deductStock(input: unknown, deps: InventoryDeps) {
  const filtered = await hooks(deps).beforeDeductionCreate(input);
  const parsed = deductStockInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_DEDUCTION_INPUT", "Deduction input is invalid.", parsed.error.issues);
  }

  const existing = await findExistingMovement(deps, parsed.data, "deduction");
  if (existing) return ok(200, await movementResult(deps, existing, true));

  const productError = await validateProduct(deps, parsed.data.tenantId, parsed.data.productId);
  if (productError) return productError;

  const balance = await deps.inventoryStore.getBalance(
    parsed.data.tenantId,
    parsed.data.productId,
    parsed.data.locationId
  );
  if (parsed.data.consumeReserved) {
    if (balance.reserved < parsed.data.quantity) return insufficientReserved(balance, parsed.data.quantity);
  } else if (balance.available < parsed.data.quantity) {
    return insufficientAvailable(balance, parsed.data.quantity);
  }

  const movement = createMovement({
    tenantId: parsed.data.tenantId,
    productId: parsed.data.productId,
    locationId: parsed.data.locationId,
    movementType: "deduction",
    quantity: parsed.data.quantity,
    onHandDelta: -parsed.data.quantity,
    reservedDelta: parsed.data.consumeReserved ? -parsed.data.quantity : 0,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId,
    reason: parsed.data.reason,
    actorId: deps.actor?.id ?? null,
    now: deps.now
  });

  const result = await recordMovement(deps, movement);
  return ok(result.idempotent ? 200 : 201, result);
}
