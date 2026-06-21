export const shipmentResources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["shipment_batches", "shipment_items", "domain_events"]
  }
] as const;
