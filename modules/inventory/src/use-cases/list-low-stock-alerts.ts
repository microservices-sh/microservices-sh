import { lowStockAlertInputSchema } from "../schemas";
import type { InventoryLowStockAlert } from "../types";
import { err, ok, type InventoryDeps } from "./shared";

export async function listLowStockAlerts(input: unknown, deps: InventoryDeps) {
  const parsed = lowStockAlertInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "inventory.INVALID_LOW_STOCK_ALERT_INPUT", "Low-stock alert input is invalid.", parsed.error.issues);
  }

  const alerts: InventoryLowStockAlert[] = [];
  for (const product of parsed.data.products) {
    if (product.trackStock === false) continue;
    const reorderPoint = product.reorderPoint ?? 0;
    const balance = await deps.inventoryStore.getBalance(parsed.data.tenantId, product.id, parsed.data.locationId);
    if (balance.available > reorderPoint) continue;
    alerts.push({
      tenantId: parsed.data.tenantId,
      productId: product.id,
      sku: product.sku ?? null,
      name: product.name ?? null,
      locationId: parsed.data.locationId,
      onHand: balance.onHand,
      reserved: balance.reserved,
      available: balance.available,
      reorderPoint,
      shortage: reorderPoint - balance.available
    });
  }

  alerts.sort((a, b) => b.shortage - a.shortage || a.productId.localeCompare(b.productId));
  return ok(200, { alerts: alerts.slice(0, parsed.data.limit ?? 100) });
}
