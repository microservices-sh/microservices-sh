export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["invoices", "invoice_line_items", "invoice_sequences", "invoice_payments"]
  }
] as const;
