import { shipmentStatusTransitionFilterSchema } from "../schemas";
import { err, ok, type ShipmentDeps } from "./shared";

export async function listShipmentStatusTransitions(input: unknown, deps: ShipmentDeps) {
  const parsed = shipmentStatusTransitionFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "shipment.INVALID_TRANSITION_FILTER", "Shipment transition filter is invalid.", parsed.error.issues);
  }

  const batch = await deps.shipmentStore.getShipment(parsed.data.tenantId, parsed.data.shipmentId);
  if (!batch) return err(404, "shipment.NOT_FOUND", "Shipment not found.");

  const transitions = await deps.shipmentStore.listShipmentStatusTransitions(parsed.data);
  return ok(200, { transitions });
}
