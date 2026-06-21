import type { ShipmentWithItems } from "./types";

export interface ShipmentHooks {
  beforeShipmentCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeShipmentComplete?: (input: unknown) => Promise<unknown> | unknown;
  afterShipmentUpdated?: (shipment: ShipmentWithItems) => Promise<void> | void;
}

export const defaultShipmentHooks: Required<ShipmentHooks> = {
  beforeShipmentCreate(input) {
    return input;
  },
  beforeShipmentComplete(input) {
    return input;
  },
  afterShipmentUpdated() {
    return undefined;
  }
};
