import type { ShipmentStore } from "../ports";
import type { ShipmentBatch, ShipmentEvent, ShipmentFilter, ShipmentItem, ShipmentStatusTransition } from "../types";

function cloneBatch(batch: ShipmentBatch): ShipmentBatch {
  return { ...batch };
}

function cloneItem(item: ShipmentItem): ShipmentItem {
  return { ...item };
}

function cloneTransition(transition: ShipmentStatusTransition): ShipmentStatusTransition {
  return { ...transition };
}

function visible(batch: ShipmentBatch, filter: ShipmentFilter, items: ShipmentItem[]): boolean {
  return (
    batch.tenantId === filter.tenantId &&
    (filter.includeCancelled || batch.status !== "cancelled") &&
    (!filter.status || batch.status === filter.status) &&
    (!filter.sourceType || items.some((item) => item.sourceType === filter.sourceType)) &&
    (!filter.sourceId || items.some((item) => item.sourceId === filter.sourceId))
  );
}

export function createMemoryShipmentStore(): ShipmentStore {
  const batches = new Map<string, ShipmentBatch>();
  const itemsByShipment = new Map<string, ShipmentItem[]>();
  const transitionsByShipment = new Map<string, ShipmentStatusTransition[]>();
  const events: ShipmentEvent[] = [];

  return {
    async insertShipment(batch, items) {
      batches.set(batch.id, cloneBatch(batch));
      itemsByShipment.set(batch.id, items.map(cloneItem));
    },
    async updateShipment(batch) {
      batches.set(batch.id, cloneBatch(batch));
    },
    async getShipment(tenantId, shipmentId) {
      const batch = batches.get(shipmentId);
      return batch && batch.tenantId === tenantId ? cloneBatch(batch) : null;
    },
    async findByExternalRef(tenantId, externalSource, externalId) {
      const batch = [...batches.values()].find(
        (item) => item.tenantId === tenantId && item.externalSource === externalSource && item.externalId === externalId
      );
      return batch ? cloneBatch(batch) : null;
    },
    async findByCompletionRef(tenantId, completionRef) {
      const batch = [...batches.values()].find((item) => item.tenantId === tenantId && item.completionRef === completionRef);
      return batch ? cloneBatch(batch) : null;
    },
    async listShipments(filter) {
      return [...batches.values()]
        .filter((batch) => visible(batch, filter, itemsByShipment.get(batch.id) ?? []))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneBatch);
    },
    async listShipmentItems(tenantId, shipmentId) {
      return (itemsByShipment.get(shipmentId) ?? []).filter((item) => item.tenantId === tenantId).map(cloneItem);
    },
    async insertShipmentStatusTransition(transition) {
      const transitions = transitionsByShipment.get(transition.shipmentId) ?? [];
      transitions.push(cloneTransition(transition));
      transitionsByShipment.set(transition.shipmentId, transitions);
    },
    async listShipmentStatusTransitions(filter) {
      return (transitionsByShipment.get(filter.shipmentId) ?? [])
        .filter((transition) => transition.tenantId === filter.tenantId)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneTransition);
    },
    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
