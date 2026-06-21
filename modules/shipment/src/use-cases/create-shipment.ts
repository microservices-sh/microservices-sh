import { shipmentInputSchema } from "../schemas";
import { isoNow, normalizeOptional, shipmentId } from "../service";
import type { ShipmentBatch, ShipmentItem } from "../types";
import { enrichShipment, err, hooks, ok, type ShipmentDeps } from "./shared";

export async function createShipment(input: unknown, deps: ShipmentDeps) {
  const filtered = await hooks(deps).beforeShipmentCreate(input);
  const parsed = shipmentInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "shipment.INVALID_SHIPMENT_INPUT", "Shipment input is invalid.", parsed.error.issues);
  }

  const externalId = normalizeOptional(parsed.data.externalId);
  const externalSource = normalizeOptional(parsed.data.externalSource);
  if ((externalId && !externalSource) || (externalSource && !externalId)) {
    return err(400, "shipment.INVALID_EXTERNAL_REF", "externalId and externalSource must be supplied together.");
  }
  if (externalId && externalSource) {
    const existing = await deps.shipmentStore.findByExternalRef(parsed.data.tenantId, externalSource, externalId);
    if (existing) return err(409, "shipment.EXTERNAL_REF_CONFLICT", "A shipment already uses this external reference.");
  }

  const now = isoNow(deps.now);
  const id = shipmentId("ship");
  const batch: ShipmentBatch = {
    id,
    tenantId: parsed.data.tenantId,
    shipmentNumber: normalizeOptional(parsed.data.shipmentNumber),
    status: "draft",
    carrier: normalizeOptional(parsed.data.carrier),
    trackingNumber: normalizeOptional(parsed.data.trackingNumber),
    notes: normalizeOptional(parsed.data.notes),
    externalId,
    externalSource,
    completionRef: null,
    inventoryDeductionRef: null,
    createdById: deps.actor?.id ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const items: ShipmentItem[] = parsed.data.items.map((item) => ({
    id: shipmentId("shipitem"),
    tenantId: batch.tenantId,
    shipmentId: batch.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    productId: normalizeOptional(item.productId),
    sku: normalizeOptional(item.sku),
    description: item.description.trim(),
    quantity: item.quantity
  }));

  await deps.shipmentStore.insertShipment(batch, items);
  await deps.shipmentStore.writeEvent({
    eventName: "shipment.created",
    entityType: "shipment",
    entityId: batch.id,
    tenantId: batch.tenantId,
    payload: { actorId: deps.actor?.id ?? null, itemCount: items.length }
  });

  const shipment = await enrichShipment(deps.shipmentStore, batch);
  await hooks(deps).afterShipmentUpdated(shipment);
  return ok(201, { shipment });
}
