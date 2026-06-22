import { defaultSalesOrderHooks, type SalesOrderHooks } from "../hooks";
import type { InventoryReservationPort, InvoiceDraftPort, SalesOrderDeliveryPort, SalesOrderStore } from "../ports";
import type { ModuleResult, SalesOrderStatus, SalesOrderWithLineItems } from "../types";

export interface SalesOrderDeps {
  salesOrderStore: SalesOrderStore;
  hooks?: SalesOrderHooks;
  inventoryReservationPort?: InventoryReservationPort;
  invoiceDraftPort?: InvoiceDraftPort;
  salesOrderDeliveryPort?: SalesOrderDeliveryPort;
  now?: () => number;
}

type ModuleError<T = never> = Extract<ModuleResult<T>, { ok: false }>;

export function err<T = never>(status: number, code: string, message: string, issues?: unknown): ModuleError<T> {
  return { ok: false, status, error: { code, message, issues } };
}

export function ok<T>(status: number, data: T): ModuleResult<T> {
  return { ok: true, status, data };
}

export function hooks(deps: SalesOrderDeps): Required<SalesOrderHooks> {
  return { ...defaultSalesOrderHooks, ...(deps.hooks ?? {}) };
}

export function invalidTransition(
  order: SalesOrderWithLineItems,
  targetStatus: SalesOrderStatus
): ModuleError<{ order: SalesOrderWithLineItems }> {
  return err(
    409,
    "sales-order.INVALID_STATUS_TRANSITION",
    `Cannot move sales order ${order.id} from ${order.status} to ${targetStatus}.`
  );
}

export function validateExternalPair(
  externalSource: string | null,
  externalId: string | null
): ModuleError | null {
  if ((externalSource && !externalId) || (externalId && !externalSource)) {
    return err(400, "sales-order.INVALID_EXTERNAL_REF", "externalSource and externalId must be supplied together.");
  }
  return null;
}
