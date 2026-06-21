import type { StockBalance, StockMovement } from "./types";

export interface InventoryHooks {
  beforeStockIn?: (input: unknown) => Promise<unknown> | unknown;
  beforeReservationCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeReleaseCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeDeductionCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeReconciliation?: (input: unknown) => Promise<unknown> | unknown;
  afterStockMovementRecorded?: (movement: StockMovement, balance: StockBalance) => Promise<void> | void;
}

export const defaultInventoryHooks: Required<InventoryHooks> = {
  beforeStockIn(input) {
    return input;
  },
  beforeReservationCreate(input) {
    return input;
  },
  beforeReleaseCreate(input) {
    return input;
  },
  beforeDeductionCreate(input) {
    return input;
  },
  beforeReconciliation(input) {
    return input;
  },
  afterStockMovementRecorded() {
    return undefined;
  }
};
