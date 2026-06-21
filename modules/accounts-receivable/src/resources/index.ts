export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["ar_invoice_snapshots", "ar_customer_payments", "ar_payment_applications", "domain_events"]
  }
] as const;
