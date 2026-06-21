import { reserveStockInputSchema } from "../schemas";
import {
  createMovement,
  err,
  findExistingMovement,
  hooks,
  insufficientAvailable,
  movementResult,
  ok,
  recordMovement,
  validateProduct,
  type InventoryDeps
} from "./shared";

export async function reserveStock(input: unknown, deps: InventoryDeps) {
  const filtered = await hooks(deps).beforeReservationCreate(input);
  const parsed = reserveStockInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_RESERVATION_INPUT", "Reservation input is invalid.", parsed.error.issues);
  }

  const existing = await findExistingMovement(deps, parsed.data, "reservation");
  if (existing) return ok(200, await movementResult(deps, existing, true));

  const productError = await validateProduct(deps, parsed.data.tenantId, parsed.data.productId);
  if (productError) return productError;

  const balance = await deps.inventoryStore.getBalance(
    parsed.data.tenantId,
    parsed.data.productId,
    parsed.data.locationId
  );
  if (balance.available < parsed.data.quantity) return insufficientAvailable(balance, parsed.data.quantity);

  const movement = createMovement({
    tenantId: parsed.data.tenantId,
    productId: parsed.data.productId,
    locationId: parsed.data.locationId,
    movementType: "reservation",
    quantity: parsed.data.quantity,
    onHandDelta: 0,
    reservedDelta: parsed.data.quantity,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId,
    reason: parsed.data.reason,
    actorId: deps.actor?.id ?? null,
    now: deps.now
  });

  const result = await recordMovement(deps, movement);
  return ok(result.idempotent ? 200 : 201, result);
}
