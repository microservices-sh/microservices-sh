import { completeShipmentSchema } from "../schemas";
import { isoNow } from "../service";
import { enrichShipment, err, hooks, ok, recordStatusTransition, type ShipmentDeps } from "./shared";

export async function completeShipment(input: unknown, deps: ShipmentDeps) {
  const filtered = await hooks(deps).beforeShipmentComplete(input);
  const parsed = completeShipmentSchema.safeParse(filtered);
  if (!parsed.success) return err(400, "shipment.INVALID_COMPLETE_INPUT", "Shipment completion input is invalid.", parsed.error.issues);

  const batch = await deps.shipmentStore.getShipment(parsed.data.tenantId, parsed.data.shipmentId);
  if (!batch) return err(404, "shipment.NOT_FOUND", "Shipment not found.");
  if (batch.status === "cancelled") return err(409, "shipment.CANCELLED", "Cancelled shipments cannot be completed.");

  if (batch.status === "completed") {
    if (batch.completionRef === parsed.data.completionRef) {
      return ok(200, { shipment: await enrichShipment(deps.shipmentStore, batch), replayed: true });
    }
    return err(409, "shipment.ALREADY_COMPLETED", "Shipment is already completed with a different completion reference.");
  }

  const existingRef = await deps.shipmentStore.findByCompletionRef(parsed.data.tenantId, parsed.data.completionRef);
  if (existingRef && existingRef.id !== batch.id) {
    return err(409, "shipment.COMPLETION_REF_CONFLICT", "Completion reference already belongs to another shipment.");
  }

  const items = await deps.shipmentStore.listShipmentItems(batch.tenantId, batch.id);
  const stockItems = items
    .filter((item) => item.productId)
    .map((item) => ({
      productId: item.productId as string,
      quantity: item.quantity,
      sourceType: item.sourceType,
      sourceId: item.sourceId
    }));
  const deduction = deps.inventoryPort
    ? await deps.inventoryPort.deductShipment({
        tenantId: batch.tenantId,
        shipmentId: batch.id,
        completionRef: parsed.data.completionRef,
        items: stockItems
      })
    : { deductionRef: parsed.data.completionRef };

  const now = parsed.data.completedAt ?? isoNow(deps.now);
  const completed = {
    ...batch,
    status: "completed" as const,
    completionRef: parsed.data.completionRef,
    inventoryDeductionRef: deduction.deductionRef,
    completedAt: now,
    updatedAt: now
  };

  await deps.shipmentStore.updateShipment(completed);
  await recordStatusTransition(deps.shipmentStore, {
    tenantId: completed.tenantId,
    shipmentId: completed.id,
    fromStatus: batch.status,
    toStatus: "completed",
    reason: "completed",
    actorId: deps.actor?.id ?? null,
    changedAt: now
  });
  await deps.shipmentStore.writeEvent({
    eventName: "shipment.completed",
    entityType: "shipment",
    entityId: completed.id,
    tenantId: completed.tenantId,
    payload: { actorId: deps.actor?.id ?? null, completionRef: completed.completionRef }
  });

  const shipment = await enrichShipment(deps.shipmentStore, completed);
  await hooks(deps).afterShipmentUpdated(shipment);
  return ok(200, { shipment, replayed: false });
}
