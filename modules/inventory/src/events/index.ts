export const inventoryEvents = {
  emitted: [
    "inventory.stock_received",
    "inventory.stock_reserved",
    "inventory.stock_released",
    "inventory.stock_deducted",
    "inventory.stock_reconciled"
  ],
  consumed: []
} as const;

export const events = inventoryEvents;
