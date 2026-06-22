export { completeReconciliationDocument } from "../use-cases/complete-reconciliation-document";
export { createReconciliationDocument } from "../use-cases/create-reconciliation-document";
export { deductStock } from "../use-cases/deduct-stock";
export { getStockBalance } from "../use-cases/get-stock-balance";
export { listLowStockAlerts } from "../use-cases/list-low-stock-alerts";
export { listReconciliationDocuments } from "../use-cases/list-reconciliation-documents";
export { listStockMovements } from "../use-cases/list-stock-movements";
export { reconcileStock } from "../use-cases/reconcile-stock";
export { releaseReservation } from "../use-cases/release-reservation";
export { reserveStock } from "../use-cases/reserve-stock";
export { stockIn } from "../use-cases/stock-in";

export function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeLocation(value: string | null | undefined): string {
  return normalizeOptional(value) ?? "default";
}

export function inventoryId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function isoNow(now?: () => number): string {
  return new Date(now ? now() : Date.now()).toISOString();
}
