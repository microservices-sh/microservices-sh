export const inventoryResources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["inventory_stock_movements", "inventory_events"]
  }
] as const;

export const resources = inventoryResources;
