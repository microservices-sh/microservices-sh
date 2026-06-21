// Enabled modules for this focused template. These ids must exist in
// microservices.lock.json; ENABLED_MODULES can still override this per deploy.
export const enabledModules: string[] | null = [
  "customer",
  "invoice",
  "payment",
  "file-media",
  "product-catalog",
  "inventory",
  "sales-order",
  "shipment",
  "commerce-sync",
  "jobs-workflows",
  "notifications-inapp",
  "webhook-delivery"
];
