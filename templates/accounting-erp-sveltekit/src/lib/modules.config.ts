// Enabled modules for this focused template. These ids must exist in
// microservices.lock.json; ENABLED_MODULES can still override this per deploy.
export const enabledModules: string[] | null = [
  "gateway",
  "customer",
  "support-ticket",
  "invoice",
  "payment",
  "file-media",
  "accounting-core",
  "accounts-payable",
  "accounts-receivable",
  "bank-reconciliation",
  "jobs-workflows",
  "webhook-delivery",
  "notifications-inapp"
];
