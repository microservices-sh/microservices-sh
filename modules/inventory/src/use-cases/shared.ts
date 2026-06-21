import { defaultInventoryHooks, type InventoryHooks } from "../hooks";
import type { InventoryProductReader, InventoryStore } from "../ports";
import { inventoryId, isoNow, normalizeOptional } from "../service";
import type {
  Actor,
  InventoryEventName,
  ModuleResult,
  StockBalance,
  StockMovement,
  StockMovementType
} from "../types";

type ModuleError = Extract<ModuleResult<never>, { ok: false }>;

export interface InventoryDeps {
  inventoryStore: InventoryStore;
  hooks?: InventoryHooks;
  now?: () => number;
  actor?: Actor | null;
  productReader?: InventoryProductReader;
}

export type MovementResult = {
  movement: StockMovement;
  balance: StockBalance;
  idempotent: boolean;
};

export function err<T = never>(status: number, code: string, message: string, issues?: unknown): ModuleResult<T> {
  return { ok: false, status, error: { code, message, issues } };
}

export function ok<T>(status: number, data: T): ModuleResult<T> {
  return { ok: true, status, data };
}

export function hooks(deps: InventoryDeps): Required<InventoryHooks> {
  return { ...defaultInventoryHooks, ...(deps.hooks ?? {}) };
}

export function movementEventName(movementType: StockMovementType): InventoryEventName {
  switch (movementType) {
    case "stock_in":
      return "inventory.stock_received";
    case "reservation":
      return "inventory.stock_reserved";
    case "release":
      return "inventory.stock_released";
    case "deduction":
      return "inventory.stock_deducted";
    case "adjustment":
      return "inventory.stock_reconciled";
  }
}

export function normalizeSourceRef(input: {
  sourceType?: string | null;
  sourceId?: string | null;
}): { sourceType: string; sourceId: string } | null {
  const sourceType = normalizeOptional(input.sourceType);
  const sourceId = normalizeOptional(input.sourceId);
  return sourceType && sourceId ? { sourceType, sourceId } : null;
}

export async function validateProduct(
  deps: InventoryDeps,
  tenantId: string,
  productId: string
): Promise<ModuleError | null> {
  if (!deps.productReader) return null;

  const product = await deps.productReader.getProduct(tenantId, productId);
  if (!product || product.id !== productId || (product.tenantId && product.tenantId !== tenantId)) {
    return err(404, "inventory.PRODUCT_NOT_FOUND", "Product was not found for this tenant.") as ModuleError;
  }
  if (product.trackStock === false) {
    return err(
      409,
      "inventory.PRODUCT_NOT_STOCK_TRACKED",
      "Product is not configured for stock tracking."
    ) as ModuleError;
  }

  return null;
}

export async function findExistingMovement(
  deps: InventoryDeps,
  input: {
    tenantId: string;
    productId: string;
    locationId: string;
    sourceType?: string | null;
    sourceId?: string | null;
  },
  movementType: StockMovementType
): Promise<StockMovement | null> {
  const sourceRef = normalizeSourceRef(input);
  if (!sourceRef) return null;
  return deps.inventoryStore.findMovementBySourceRef(
    input.tenantId,
    input.productId,
    input.locationId,
    movementType,
    sourceRef.sourceType,
    sourceRef.sourceId
  );
}

export async function movementResult(
  deps: InventoryDeps,
  movement: StockMovement,
  idempotent: boolean
): Promise<MovementResult> {
  const balance = await deps.inventoryStore.getBalance(movement.tenantId, movement.productId, movement.locationId);
  return { movement, balance, idempotent };
}

export function createMovement(input: {
  tenantId: string;
  productId: string;
  locationId: string;
  movementType: StockMovementType;
  quantity: number;
  onHandDelta: number;
  reservedDelta: number;
  sourceType?: string | null;
  sourceId?: string | null;
  reason?: string | null;
  actorId?: string | null;
  now?: () => number;
}): StockMovement {
  const sourceRef = normalizeSourceRef(input);
  return {
    id: inventoryId("inv_mv"),
    tenantId: input.tenantId,
    productId: input.productId,
    locationId: input.locationId,
    movementType: input.movementType,
    quantity: input.quantity,
    onHandDelta: input.onHandDelta,
    reservedDelta: input.reservedDelta,
    sourceType: sourceRef?.sourceType ?? null,
    sourceId: sourceRef?.sourceId ?? null,
    reason: normalizeOptional(input.reason),
    createdById: input.actorId ?? null,
    createdAt: isoNow(input.now)
  };
}

export async function recordMovement(deps: InventoryDeps, movement: StockMovement): Promise<MovementResult> {
  let saved = movement;
  let idempotent = false;

  try {
    await deps.inventoryStore.insertMovement(movement);
  } catch (error) {
    if (!movement.sourceType || !movement.sourceId) throw error;
    const existing = await deps.inventoryStore.findMovementBySourceRef(
      movement.tenantId,
      movement.productId,
      movement.locationId,
      movement.movementType,
      movement.sourceType,
      movement.sourceId
    );
    if (!existing) throw error;
    saved = existing;
    idempotent = true;
  }

  const result = await movementResult(deps, saved, idempotent);
  if (!idempotent) {
    await deps.inventoryStore.writeEvent({
      eventName: movementEventName(saved.movementType),
      entityType: "stock_movement",
      entityId: saved.id,
      tenantId: saved.tenantId,
      payload: {
        productId: saved.productId,
        locationId: saved.locationId,
        quantity: saved.quantity,
        onHandDelta: saved.onHandDelta,
        reservedDelta: saved.reservedDelta,
        sourceType: saved.sourceType,
        sourceId: saved.sourceId
      }
    });
    await hooks(deps).afterStockMovementRecorded(saved, result.balance);
  }

  return result;
}

export function insufficientAvailable(balance: StockBalance, quantity: number) {
  return err(
    409,
    "inventory.INSUFFICIENT_AVAILABLE",
    `Insufficient available stock. Available: ${balance.available}; requested: ${quantity}.`
  );
}

export function insufficientReserved(balance: StockBalance, quantity: number) {
  return err(
    409,
    "inventory.INSUFFICIENT_RESERVED",
    `Insufficient reserved stock. Reserved: ${balance.reserved}; requested: ${quantity}.`
  );
}
