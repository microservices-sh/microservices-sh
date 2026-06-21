import { getShipmentSchema } from "../schemas";
import { enrichShipment, err, ok, type ShipmentDeps } from "./shared";

export async function getShipment(input: unknown, deps: ShipmentDeps) {
  const parsed = getShipmentSchema.safeParse(input);
  if (!parsed.success) return err(400, "shipment.INVALID_GET_INPUT", "Shipment lookup is invalid.", parsed.error.issues);
  const batch = await deps.shipmentStore.getShipment(parsed.data.tenantId, parsed.data.shipmentId);
  if (!batch) return err(404, "shipment.NOT_FOUND", "Shipment not found.");
  return ok(200, { shipment: await enrichShipment(deps.shipmentStore, batch) });
}
