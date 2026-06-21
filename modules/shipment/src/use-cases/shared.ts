import { defaultShipmentHooks, type ShipmentHooks } from "../hooks";
import type { ShipmentInventoryPort, ShipmentStore } from "../ports";
import type { ModuleResult, ShipmentBatch, ShipmentWithItems } from "../types";

export interface ShipmentDeps {
  shipmentStore: ShipmentStore;
  inventoryPort?: ShipmentInventoryPort;
  hooks?: ShipmentHooks;
  now?: () => number;
  actor?: { id: string } | null;
}

export function err<T = never>(status: number, code: string, message: string, issues?: unknown): ModuleResult<T> {
  return { ok: false, status, error: { code, message, issues } };
}

export function ok<T>(status: number, data: T): ModuleResult<T> {
  return { ok: true, status, data };
}

export function hooks(deps: ShipmentDeps): Required<ShipmentHooks> {
  return { ...defaultShipmentHooks, ...(deps.hooks ?? {}) };
}

export async function enrichShipment(store: ShipmentStore, batch: ShipmentBatch): Promise<ShipmentWithItems> {
  return { ...batch, items: await store.listShipmentItems(batch.tenantId, batch.id) };
}
