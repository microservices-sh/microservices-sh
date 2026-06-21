import { shipmentFilterSchema } from "../schemas";
import { enrichShipment, err, ok, type ShipmentDeps } from "./shared";

export async function listShipments(input: unknown, deps: ShipmentDeps) {
  const parsed = shipmentFilterSchema.safeParse(input);
  if (!parsed.success) return err(400, "shipment.INVALID_FILTER", "Shipment filter is invalid.", parsed.error.issues);
  const batches = await deps.shipmentStore.listShipments(parsed.data);
  const shipments = await Promise.all(batches.map((batch) => enrichShipment(deps.shipmentStore, batch)));
  return ok(200, { shipments });
}
