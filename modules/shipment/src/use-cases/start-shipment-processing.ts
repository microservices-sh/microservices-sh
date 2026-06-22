import { startShipmentProcessingSchema } from "../schemas";
import { isoNow } from "../service";
import { enrichShipment, err, hooks, ok, recordStatusTransition, type ShipmentDeps } from "./shared";

export async function startShipmentProcessing(input: unknown, deps: ShipmentDeps) {
  const parsed = startShipmentProcessingSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "shipment.INVALID_PROCESSING_INPUT", "Shipment processing input is invalid.", parsed.error.issues);
  }

  const batch = await deps.shipmentStore.getShipment(parsed.data.tenantId, parsed.data.shipmentId);
  if (!batch) return err(404, "shipment.NOT_FOUND", "Shipment not found.");
  if (batch.status === "processing") return ok(200, { shipment: await enrichShipment(deps.shipmentStore, batch), replayed: true });
  if (batch.status === "completed") return err(409, "shipment.ALREADY_COMPLETED", "Completed shipments cannot return to processing.");
  if (batch.status === "cancelled") return err(409, "shipment.CANCELLED", "Cancelled shipments cannot be processed.");

  const now = parsed.data.changedAt ?? isoNow(deps.now);
  const processing = { ...batch, status: "processing" as const, updatedAt: now };
  await deps.shipmentStore.updateShipment(processing);
  await recordStatusTransition(deps.shipmentStore, {
    tenantId: processing.tenantId,
    shipmentId: processing.id,
    fromStatus: batch.status,
    toStatus: "processing",
    reason: parsed.data.reason ?? "processing_started",
    actorId: deps.actor?.id ?? null,
    changedAt: now
  });
  await deps.shipmentStore.writeEvent({
    eventName: "shipment.processing_started",
    entityType: "shipment",
    entityId: processing.id,
    tenantId: processing.tenantId,
    payload: { actorId: deps.actor?.id ?? null, reason: parsed.data.reason ?? null }
  });

  const shipment = await enrichShipment(deps.shipmentStore, processing);
  await hooks(deps).afterShipmentUpdated(shipment);
  return ok(200, { shipment, replayed: false });
}
