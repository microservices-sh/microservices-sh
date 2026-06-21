export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "invoices",
      "invoice_line_items",
      "invoice_sequences",
      "invoice_payments",
      "invoice_recurring_templates",
      "invoice_recurring_template_line_items"
    ]
  }
] as const;
