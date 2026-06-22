import { cancelShipmentSchema } from "../schemas";
import { isoNow } from "../service";
import { enrichShipment, err, hooks, ok, recordStatusTransition, type ShipmentDeps } from "./shared";

export async function cancelShipment(input: unknown, deps: ShipmentDeps) {
  const parsed = cancelShipmentSchema.safeParse(input);
  if (!parsed.success) return err(400, "shipment.INVALID_CANCEL_INPUT", "Shipment cancellation input is invalid.", parsed.error.issues);
  const batch = await deps.shipmentStore.getShipment(parsed.data.tenantId, parsed.data.shipmentId);
  if (!batch) return err(404, "shipment.NOT_FOUND", "Shipment not found.");
  if (batch.status === "completed") return err(409, "shipment.ALREADY_COMPLETED", "Completed shipments cannot be cancelled.");
  if (batch.status === "cancelled") return ok(200, { shipment: await enrichShipment(deps.shipmentStore, batch), replayed: true });

  const now = isoNow(deps.now);
  const cancelled = { ...batch, status: "cancelled" as const, updatedAt: now };
  await deps.shipmentStore.updateShipment(cancelled);
  await recordStatusTransition(deps.shipmentStore, {
    tenantId: cancelled.tenantId,
    shipmentId: cancelled.id,
    fromStatus: batch.status,
    toStatus: "cancelled",
    reason: parsed.data.reason ?? "cancelled",
    actorId: deps.actor?.id ?? null,
    changedAt: now
  });
  await deps.shipmentStore.writeEvent({
    eventName: "shipment.cancelled",
    entityType: "shipment",
    entityId: cancelled.id,
    tenantId: cancelled.tenantId,
    payload: { actorId: deps.actor?.id ?? null, reason: parsed.data.reason ?? null }
  });

  const shipment = await enrichShipment(deps.shipmentStore, cancelled);
  await hooks(deps).afterShipmentUpdated(shipment);
  return ok(200, { shipment, replayed: false });
}
